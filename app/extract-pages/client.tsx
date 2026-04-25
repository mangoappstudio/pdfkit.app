"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Check, FileOutput, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractPages, getPDFPageCount, parsePageRanges } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

import type { PDFDocumentProxy } from "pdfjs-dist";

export function ExtractPagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [rangeStr, setRangeStr] = useState("");

  const [thumbUrls, setThumbUrls] = useState<(string | null)[]>([]);
  const [isRenderingThumbs, setIsRenderingThumbs] = useState(false);
  const [thumbsRendered, setThumbsRendered] = useState(0);
  const thumbUrlsRef = useRef<string[]>([]);
  const thumbGenerationIdRef = useRef(0);
  const lastClickedPageRef = useRef<number | null>(null);

  const revokeThumbUrls = useCallback(() => {
    thumbUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    thumbUrlsRef.current = [];
  }, []);

  const resetThumbState = useCallback(() => {
    thumbGenerationIdRef.current += 1;
    revokeThumbUrls();
    setThumbUrls([]);
    setThumbsRendered(0);
    setIsRenderingThumbs(false);
  }, [revokeThumbUrls]);

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    resetThumbState();
    setFile(f);
    setSelected(new Set());
    setRangeStr("");
    lastClickedPageRef.current = null;
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
      setThumbUrls(Array.from({ length: count }, () => null));
      setThumbsRendered(0);
      setIsRenderingThumbs(true);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
      setPageCount(0);
    }
  }, [resetThumbState]);

  useEffect(() => {
    if (!file || pageCount <= 0) return;

    const fileForThumbs = file;
    let cancelled = false;
    const generationId = ++thumbGenerationIdRef.current;

    async function renderThumbnails() {
      let pdfDoc: PDFDocumentProxy | null = null;
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await fileForThumbs.arrayBuffer();
        pdfDoc = (await (pdfjsLib.getDocument({ data: arrayBuffer }).promise as Promise<PDFDocumentProxy>));

        const desiredWidth = 160;
        const totalPages = Math.min(pageCount, pdfDoc.numPages ?? pageCount);
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          if (cancelled || generationId !== thumbGenerationIdRef.current) return;

          const page = await pdfDoc.getPage(pageIndex + 1);
          const viewport = page.getViewport({ scale: 1 });
          const scale = Math.min(desiredWidth / viewport.width, 1);
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.ceil(scaledViewport.width));
          canvas.height = Math.max(1, Math.ceil(scaledViewport.height));

          await page.render({ canvas, viewport: scaledViewport }).promise;
          if (cancelled || generationId !== thumbGenerationIdRef.current) return;

          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to generate thumbnail."))), "image/png");
          });
          if (cancelled || generationId !== thumbGenerationIdRef.current) return;

          const url = URL.createObjectURL(blob);
          if (cancelled || generationId !== thumbGenerationIdRef.current) {
            URL.revokeObjectURL(url);
            return;
          }
          thumbUrlsRef.current[pageIndex] = url;
          setThumbUrls((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            next[pageIndex] = url;
            return next;
          });
          setThumbsRendered((n) => n + 1);

          await new Promise((r) => setTimeout(r, 0));
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to render previews.";
          toast.error(msg.includes("password") ? "This PDF may be password-protected." : msg);
        }
      } finally {
        try {
          await pdfDoc?.destroy?.();
        } catch {
          // ignore
        }
        if (!cancelled) setIsRenderingThumbs(false);
      }
    }

    renderThumbnails();
    return () => {
      cancelled = true;
      revokeThumbUrls();
    };
  }, [file, pageCount, revokeThumbUrls]);

  function togglePage(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function handlePageClick(idx: number, e: React.MouseEvent<HTMLButtonElement>) {
    if (e.shiftKey && lastClickedPageRef.current !== null) {
      const start = Math.min(lastClickedPageRef.current, idx);
      const end = Math.max(lastClickedPageRef.current, idx);
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(i);
        return next;
      });
    } else {
      togglePage(idx);
    }
    lastClickedPageRef.current = idx;
  }

  function selectAll() {
    setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function invertSelection() {
    setSelected((prev) => {
      const next = new Set<number>();
      for (let i = 0; i < pageCount; i++) {
        if (!prev.has(i)) next.add(i);
      }
      return next;
    });
  }

  function selectOddEven(kind: "odd" | "even") {
    const isOdd = kind === "odd";
    const next = new Set<number>();
    for (let i = 0; i < pageCount; i++) {
      const pageNumber = i + 1;
      if ((pageNumber % 2 === 1) === isOdd) next.add(i);
    }
    setSelected(next);
  }

  function applyRange(mode: "replace" | "add") {
    const raw = rangeStr.trim();
    if (!raw) return;
    try {
      const indices = parsePageRanges(raw, pageCount);
      if (indices.length === 0) return;
      setSelected((prev) => {
        const next = mode === "replace" ? new Set<number>() : new Set(prev);
        indices.forEach((i) => next.add(i));
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid page range.";
      toast.error(msg);
    }
  }

  const handleExtract = async () => {
    if (!file || selected.size === 0) return;
    setIsProcessing(true);
    try {
      const indices = [...selected].sort((a, b) => a - b);
      const bytes = await extractPages(file, indices);
      downloadFile(bytes, `${file.name.replace(/\.pdf$/i, "")}-extracted.pdf`);
      toast.success(`Extracted ${indices.length} page${indices.length !== 1 ? "s" : ""} and downloaded!`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to extract pages.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="Extract Pages"
      description="Select the pages you want to keep and export them as a new PDF."
    >
      <div className="space-y-6">
        {!file ? (
          <DropZone
            onDrop={handleDrop}
            accept={PDF_ACCEPT}
            multiple={false}
            label="Drop a PDF file here or click to browse"
          />
        ) : (
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
            <FileText className="w-5 h-5 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{pageCount} pages</p>
            </div>
            <button
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              onClick={() => {
                resetThumbState();
                setFile(null);
                setPageCount(0);
                setSelected(new Set());
                setRangeStr("");
                lastClickedPageRef.current = null;
              }}
            >
              Remove
            </button>
          </div>
        )}

        {pageCount > 0 && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-sm text-gray-500">
                  {selected.size} of {pageCount} page{pageCount !== 1 ? "s" : ""} selected
                </p>
                {isRenderingThumbs && (
                  <p className="text-xs text-gray-400">
                    Rendering previews… {thumbsRendered}/{pageCount}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={selectAll}>
                  All
                </Button>
                <Button size="sm" variant="outline" onClick={clearAll}>
                  None
                </Button>
                <Button size="sm" variant="outline" onClick={invertSelection}>
                  Invert
                </Button>
                <Button size="sm" variant="outline" onClick={() => selectOddEven("odd")}>
                  Odd
                </Button>
                <Button size="sm" variant="outline" onClick={() => selectOddEven("even")}>
                  Even
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={rangeStr}
                onChange={(e) => setRangeStr(e.target.value)}
                placeholder="Page range (e.g. 1-3,5,8-10)"
                className="sm:max-w-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => applyRange("replace")} disabled={!rangeStr.trim()}>
                  Select range
                </Button>
                <Button size="sm" variant="outline" onClick={() => applyRange("add")} disabled={!rangeStr.trim()}>
                  Add
                </Button>
              </div>
              <p className="text-xs text-gray-400 sm:ml-auto">
                Tip: shift-click to select a range
              </p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  onClick={(e) => handlePageClick(i, e)}
                  className={`group relative aspect-[3/4] rounded-lg border-2 overflow-hidden bg-white transition-all ${
                    selected.has(i)
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-400 hover:border-gray-300 hover:shadow-sm"
                  }`}
                  aria-label={`Page ${i + 1}${selected.has(i) ? " (selected)" : ""}`}
                  aria-pressed={selected.has(i)}
                >
                  {thumbUrls[i] ? (
                    <img
                      src={thumbUrls[i]!}
                      alt={`Page ${i + 1} preview`}
                      className="w-full h-full object-contain bg-white"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      {isRenderingThumbs ? (
                        <Loader2 className="w-4 h-4 text-gray-300 animate-spin" aria-hidden="true" />
                      ) : (
                        <span className="text-sm font-semibold text-gray-300">{i + 1}</span>
                      )}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />

                  <span className="absolute bottom-1 left-2 text-xs text-gray-600 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded">
                    p. {i + 1}
                  </span>

                  {selected.has(i) && (
                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                      <Check className="w-4 h-4" aria-hidden="true" />
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleExtract}
                disabled={selected.size === 0 || isProcessing}
                className="gap-2"
              >
                <FileOutput className="w-4 h-4" />
                {isProcessing ? "Extracting…" : `Extract ${selected.size} page${selected.size !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </ToolLayout>
  );
}
