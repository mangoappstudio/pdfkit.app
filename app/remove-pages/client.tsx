"use client";

import { useRef, useState, useCallback } from "react";
import { Check, MinusSquare, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { extractPages, getPDFPageCount } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";
import { Input } from "@/components/ui/input";
import { parsePageRanges } from "@/lib/pdf-utils";
import { usePdfThumbnails } from "@/components/use-pdf-thumbnails";

export function RemovePagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [toRemove, setToRemove] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [rangeStr, setRangeStr] = useState("");
  const lastClickedPageRef = useRef<number | null>(null);

  const { urls: thumbUrls, isRendering: isRenderingThumbs, renderedCount: thumbsRendered, reset: resetThumbs } =
    usePdfThumbnails(file, pageCount, { width: 160, maxScale: 1, yieldEvery: 1 });

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    resetThumbs();
    setFile(f);
    setToRemove(new Set());
    setRangeStr("");
    lastClickedPageRef.current = null;
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
      setPageCount(0);
    }
  }, [resetThumbs]);

  function togglePage(idx: number) {
    setToRemove((prev) => {
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
      setToRemove((prev) => {
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
    setToRemove(new Set(Array.from({ length: pageCount }, (_, i) => i)));
  }

  function clearAll() {
    setToRemove(new Set());
  }

  function invertSelection() {
    setToRemove((prev) => {
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
    setToRemove(next);
  }

  function applyRange(mode: "replace" | "add") {
    const raw = rangeStr.trim();
    if (!raw) return;
    try {
      const indices = parsePageRanges(raw, pageCount);
      if (indices.length === 0) return;
      setToRemove((prev) => {
        const next = mode === "replace" ? new Set<number>() : new Set(prev);
        indices.forEach((i) => next.add(i));
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid page range.";
      toast.error(msg);
    }
  }

  const remainingCount = pageCount - toRemove.size;

  const handleExport = async () => {
    if (!file || toRemove.size === 0 || remainingCount === 0) return;
    setIsProcessing(true);
    try {
      const keepIndices = Array.from({ length: pageCount }, (_, i) => i).filter(
        (i) => !toRemove.has(i)
      );
      const bytes = await extractPages(file, keepIndices);
      downloadFile(bytes, `${file.name.replace(/\.pdf$/i, "")}-pages-removed.pdf`);
      toast.success(`Exported PDF with ${keepIndices.length} page${keepIndices.length !== 1 ? "s" : ""}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export PDF.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="Remove Pages"
      description="Select the pages you want to remove, then export the rest as a new PDF."
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
                resetThumbs();
                setFile(null);
                setPageCount(0);
                setToRemove(new Set());
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
                  {toRemove.size > 0
                    ? `${toRemove.size} page${toRemove.size !== 1 ? "s" : ""} marked for removal · ${remainingCount} will remain`
                    : `${pageCount} pages · select pages to remove`}
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
                    toRemove.has(i)
                      ? "border-red-400 bg-red-50"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }`}
                  aria-label={`Page ${i + 1}${toRemove.has(i) ? " (marked for removal)" : ""}`}
                  aria-pressed={toRemove.has(i)}
                >
                  {thumbUrls[i] ? (
                    <img
                      src={thumbUrls[i]!}
                      alt={`Page ${i + 1} preview`}
                      className={`w-full h-full object-contain bg-white ${toRemove.has(i) ? "opacity-60" : ""}`}
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

                  <div className={`absolute inset-0 transition-colors ${toRemove.has(i) ? "bg-red-500/10" : "bg-black/0 group-hover:bg-black/5"}`} />

                  <span className="absolute bottom-1 left-2 text-xs text-gray-600 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded">
                    p. {i + 1}
                  </span>

                  {toRemove.has(i) && (
                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-sm">
                      <Check className="w-4 h-4" aria-hidden="true" />
                    </span>
                  )}
                </button>
              ))}
            </div>

            {remainingCount === 0 && toRemove.size > 0 && (
              <p className="text-sm text-red-500">
                You have selected all pages. At least one page must remain.
              </p>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleExport}
                disabled={toRemove.size === 0 || remainingCount === 0 || isProcessing}
                className="gap-2"
              >
                <MinusSquare className="w-4 h-4" />
                {isProcessing
                  ? "Exporting…"
                  : toRemove.size > 0
                  ? `Export without ${toRemove.size} page${toRemove.size !== 1 ? "s" : ""}`
                  : "Select pages to remove"}
              </Button>
            </div>
          </>
        )}
      </div>
    </ToolLayout>
  );
}
