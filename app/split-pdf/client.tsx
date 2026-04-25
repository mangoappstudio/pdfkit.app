"use client";

import { useRef, useState, useCallback } from "react";
import { Download, FileText, Loader2, Scissors } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { splitPDFByRanges, splitPDFIntoPages, getPDFPageCount, parsePageRanges } from "@/lib/pdf-utils";
import { downloadBlob, downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";
import { usePdfThumbnails } from "@/components/use-pdf-thumbnails";

type SplitMode = "ranges" | "all-pages";

export function SplitPDFClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [mode, setMode] = useState<SplitMode>("ranges");
  const [rangeInput, setRangeInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ name: string; bytes: Uint8Array }[]>([]);
  const [showPreviews, setShowPreviews] = useState(true);
  const rangeStartRef = useRef<number | null>(null);

  const { urls: thumbUrls, isRendering: isRenderingThumbs, renderedCount: thumbsRendered, reset: resetThumbs } =
    usePdfThumbnails(file, pageCount, { width: 160, maxScale: 1, yieldEvery: 2 });

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    resetThumbs();
    setFile(f);
    setResults([]);
    setRangeInput("");
    rangeStartRef.current = null;
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
      setPageCount(0);
    }
  }, [resetThumbs]);

  function appendToken(token: string) {
    setRangeInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return token;
      const lastChar = trimmed[trimmed.length - 1];
      const needsSeparator = lastChar !== ";" && lastChar !== "," && lastChar !== "-";
      return `${trimmed}${needsSeparator ? "," : ""}${token}`;
    });
  }

  function handlePreviewClick(pageNumber: number) {
    if (mode !== "ranges") return;
    const currentStart = rangeStartRef.current;
    if (currentStart === null) {
      rangeStartRef.current = pageNumber;
      toast.message(`Range start set to page ${pageNumber}. Click an end page to complete.`);
      return;
    }
    const start = Math.min(currentStart, pageNumber);
    const end = Math.max(currentStart, pageNumber);
    appendToken(start === end ? `${start}` : `${start}-${end}`);
    rangeStartRef.current = null;
  }

  async function downloadAllAsZip() {
    if (results.length === 0) return;
    const zip = new JSZip();
    results.forEach((r) => zip.file(r.name, r.bytes));
    const blob = await zip.generateAsync({ type: "blob" });
    const baseName = file ? file.name.replace(/\.pdf$/i, "") : "split";
    downloadBlob(blob, `${baseName}-split.zip`);
  }

  const handleSplit = async () => {
    if (!file) return;
    setIsProcessing(true);
    setResults([]);
    try {
      if (mode === "all-pages") {
        const pages = await splitPDFIntoPages(file);
        if (pages.length === 1) {
          downloadFile(pages[0], `${file.name.replace(/\.pdf$/i, "")}-page-1.pdf`);
          toast.success("PDF split into 1 page downloaded.");
        } else {
          const baseName = file.name.replace(/\.pdf$/i, "");
          const newResults = pages.map((bytes, i) => ({
            name: `${baseName}-page-${i + 1}.pdf`,
            bytes,
          }));
          setResults(newResults);
          toast.success(`PDF split into ${pages.length} pages. Click each to download.`);
        }
      } else {
        if (!rangeInput.trim()) {
          toast.error("Please enter page ranges.");
          return;
        }
        const rangeGroups = rangeInput.split(";").map((s) => s.trim()).filter(Boolean);
        const indexGroups = rangeGroups.map((group) => parsePageRanges(group, pageCount));
        const pdfs = await splitPDFByRanges(file, indexGroups);
        const baseName = file.name.replace(/\.pdf$/i, "");
        if (pdfs.length === 1) {
          downloadFile(pdfs[0], `${baseName}-part-1.pdf`);
          toast.success("PDF exported and downloaded.");
        } else {
          const newResults = pdfs.map((bytes, i) => ({
            name: `${baseName}-part-${i + 1}.pdf`,
            bytes,
          }));
          setResults(newResults);
          toast.success(`${pdfs.length} parts ready. Click each to download.`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to split PDF.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="Split PDF"
      description="Split a PDF by page ranges, or extract every page as a separate file."
    >
      <div className="space-y-6">
        {!file ? (
          <DropZone
            onDrop={handleDrop}
            accept={PDF_ACCEPT}
            multiple={false}
            label="Drop a PDF file here or click to browse"
            sublabel="Single PDF only"
          />
        ) : (
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
            <FileText className="w-5 h-5 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{pageCount} pages</p>
            </div>
            <button
              className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0"
              onClick={() => {
                resetThumbs();
                setFile(null);
                setPageCount(0);
                setResults([]);
                setRangeInput("");
                rangeStartRef.current = null;
              }}
            >
              Remove
            </button>
          </div>
        )}

        {file && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Split options</h2>

            <div className="flex gap-3">
              <button
                onClick={() => setMode("ranges")}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  mode === "ranges"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                By page ranges
              </button>
              <button
                onClick={() => setMode("all-pages")}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  mode === "all-pages"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                Every page separately
              </button>
            </div>

            {mode === "ranges" && (
              <div className="space-y-2">
                <Label htmlFor="ranges">
                  Page ranges{" "}
                  <span className="text-gray-400 font-normal">
                    (e.g. <code className="bg-gray-100 px-1 rounded text-xs">1-3</code> or{" "}
                    <code className="bg-gray-100 px-1 rounded text-xs">1-3;4-6;7</code> for multiple parts)
                  </span>
                </Label>
                <Input
                  id="ranges"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="e.g. 1-3 or 1-3;4-6;7"
                />
                <p className="text-xs text-gray-400">
                  Separate multiple output parts with a semicolon ( ; ). Each part becomes a separate PDF.
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Tip: click page previews below to build ranges quickly.
                  </p>
                  <button
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setRangeInput("")}
                    type="button"
                  >
                    Clear input
                  </button>
                </div>
              </div>
            )}

            {mode === "all-pages" && (
              <p className="text-sm text-gray-500">
                Each page will be exported as an individual PDF file ({pageCount} files total).
              </p>
            )}
          </div>
        )}

        {file && mode === "ranges" && showPreviews && pageCount > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold text-gray-800">Page previews</h2>
                {isRenderingThumbs && (
                  <p className="text-xs text-gray-400">
                    Rendering previews… {thumbsRendered}/{pageCount}
                  </p>
                )}
              </div>
              <button
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowPreviews(false)}
                type="button"
              >
                Hide
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {Array.from({ length: pageCount }, (_, i) => {
                const pageNumber = i + 1;
                return (
                  <button
                    key={i}
                    onClick={() => handlePreviewClick(pageNumber)}
                    className="group relative aspect-[3/4] rounded-lg border-2 overflow-hidden bg-white transition-all border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    aria-label={`Use page ${pageNumber} in range builder`}
                    type="button"
                  >
                    {thumbUrls[i] ? (
                      <img
                        src={thumbUrls[i]!}
                        alt={`Page ${pageNumber} preview`}
                        className="w-full h-full object-contain bg-white"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        {isRenderingThumbs ? (
                          <Loader2 className="w-4 h-4 text-gray-300 animate-spin" aria-hidden="true" />
                        ) : (
                          <span className="text-sm font-semibold text-gray-300">{pageNumber}</span>
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                    <span className="absolute bottom-1 left-2 text-xs text-gray-600 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded">
                      p. {pageNumber}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Click once to set a start page, then click again to set an end page.
              </p>
              <button
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => { rangeStartRef.current = null; toast.message("Range start cleared."); }}
                type="button"
              >
                Clear start
              </button>
            </div>
          </div>
        )}

        {file && mode === "ranges" && !showPreviews && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowPreviews(true)}>
              Show page previews
            </Button>
          </div>
        )}

        {file && (
          <div className="flex justify-end">
            <Button onClick={handleSplit} disabled={!file || isProcessing} className="gap-2">
              <Scissors className="w-4 h-4" />
              {isProcessing ? "Splitting…" : "Split PDF"}
            </Button>
          </div>
        )}

        {results.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Download parts</h2>
              {results.length > 1 && (
                <Button variant="outline" size="sm" onClick={downloadAllAsZip} className="gap-2">
                  <Download className="w-4 h-4" />
                  Download all (.zip)
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {results.map((result, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700">{result.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(result.bytes, result.name)}
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
