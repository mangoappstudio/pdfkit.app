"use client";

import { useState, useCallback } from "react";
import { FileOutput, FileText } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { extractPages, getPDFPageCount } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

export function ExtractPagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setSelected(new Set());
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
    }
  }, []);

  function togglePage(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i)));
  }

  function clearAll() {
    setSelected(new Set());
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
              onClick={() => { setFile(null); setPageCount(0); setSelected(new Set()); }}
            >
              Remove
            </button>
          </div>
        )}

        {pageCount > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {selected.size} of {pageCount} page{pageCount !== 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-2">
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
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
                    selected.has(i)
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
                  }`}
                  aria-label={`Page ${i + 1}${selected.has(i) ? " (selected)" : ""}`}
                  aria-pressed={selected.has(i)}
                >
                  {i + 1}
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
