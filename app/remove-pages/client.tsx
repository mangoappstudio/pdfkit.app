"use client";

import { useState, useCallback } from "react";
import { MinusSquare, FileText } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { extractPages, getPDFPageCount } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

export function RemovePagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [toRemove, setToRemove] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setToRemove(new Set());
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
    }
  }, []);

  function togglePage(idx: number) {
    setToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() {
    setToRemove(new Set(Array.from({ length: pageCount }, (_, i) => i)));
  }

  function clearAll() {
    setToRemove(new Set());
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
              onClick={() => { setFile(null); setPageCount(0); setToRemove(new Set()); }}
            >
              Remove
            </button>
          </div>
        )}

        {pageCount > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {toRemove.size > 0
                  ? `${toRemove.size} page${toRemove.size !== 1 ? "s" : ""} marked for removal · ${remainingCount} will remain`
                  : `${pageCount} pages · select pages to remove`}
              </p>
              <div className="flex gap-2">
                <button
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  onClick={selectAll}
                >
                  Select all
                </button>
                <span className="text-gray-300">|</span>
                <button
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={clearAll}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  onClick={() => togglePage(i)}
                  className={`aspect-[3/4] rounded-lg border-2 flex items-center justify-center text-sm font-semibold transition-all ${
                    toRemove.has(i)
                      ? "border-red-400 bg-red-50 text-red-600 line-through opacity-60"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                  aria-label={`Page ${i + 1}${toRemove.has(i) ? " (marked for removal)" : ""}`}
                  aria-pressed={toRemove.has(i)}
                >
                  {i + 1}
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
