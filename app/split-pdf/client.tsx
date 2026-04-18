"use client";

import { useState, useCallback } from "react";
import { Scissors, FileText } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { splitPDFByRanges, splitPDFIntoPages, getPDFPageCount, parsePageRanges } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

type SplitMode = "ranges" | "all-pages";

export function SplitPDFClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [mode, setMode] = useState<SplitMode>("ranges");
  const [rangeInput, setRangeInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ name: string; bytes: Uint8Array }[]>([]);

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setResults([]);
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
    }
  }, []);

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
              onClick={() => { setFile(null); setPageCount(0); setResults([]); }}
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
              </div>
            )}

            {mode === "all-pages" && (
              <p className="text-sm text-gray-500">
                Each page will be exported as an individual PDF file ({pageCount} files total).
              </p>
            )}
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
            <h2 className="text-sm font-semibold text-gray-800">Download parts</h2>
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
