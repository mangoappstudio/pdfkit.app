"use client";

import { useState, useCallback } from "react";
import { FileOutput, FileText } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractPages, getPDFPageCount } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";
import { usePdfThumbnails } from "@/components/use-pdf-thumbnails";
import { usePageSelection } from "@/components/use-page-selection";
import { PageThumbnailGrid } from "@/components/page-thumbnail-grid";

export function ExtractPagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const selection = usePageSelection(pageCount);
  const {
    urls: thumbUrls,
    isRendering: isRenderingThumbs,
    renderedCount: thumbsRendered,
    reset: resetThumbs,
  } = usePdfThumbnails(file, pageCount, { width: 160, maxScale: 1, yieldEvery: 1 });

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    resetThumbs();
    setFile(f);
    selection.reset();
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
      setPageCount(0);
    }
  }, [resetThumbs, selection]);

  const handleExtract = async () => {
    if (!file || selection.selected.size === 0) return;
    setIsProcessing(true);
    try {
      const indices = [...selection.selected].sort((a, b) => a - b);
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
                resetThumbs();
                setFile(null);
                setPageCount(0);
                selection.reset();
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
                  {selection.selected.size} of {pageCount} page{pageCount !== 1 ? "s" : ""} selected
                </p>
                {isRenderingThumbs && (
                  <p className="text-xs text-gray-400">
                    Rendering previews… {thumbsRendered}/{pageCount}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={selection.selectAll}>
                  All
                </Button>
                <Button size="sm" variant="outline" onClick={selection.clearAll}>
                  None
                </Button>
                <Button size="sm" variant="outline" onClick={selection.invertSelection}>
                  Invert
                </Button>
                <Button size="sm" variant="outline" onClick={() => selection.selectOddEven("odd")}>
                  Odd
                </Button>
                <Button size="sm" variant="outline" onClick={() => selection.selectOddEven("even")}>
                  Even
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={selection.rangeInput}
                onChange={(e) => selection.setRangeInput(e.target.value)}
                placeholder="Page range (e.g. 1-3,5,8-10)"
                className="sm:max-w-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const res = selection.applyRange("replace");
                    if (!res.ok && res.error) toast.error(res.error);
                  }}
                  disabled={!selection.rangeInput.trim()}
                >
                  Select range
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const res = selection.applyRange("add");
                    if (!res.ok && res.error) toast.error(res.error);
                  }}
                  disabled={!selection.rangeInput.trim()}
                >
                  Add
                </Button>
              </div>
              <p className="text-xs text-gray-400 sm:ml-auto">
                Tip: shift-click to select a range
              </p>
            </div>

            <PageThumbnailGrid
              pageCount={pageCount}
              thumbnailUrls={thumbUrls}
              selectedPages={selection.selected}
              onPageClick={selection.clickPage}
              variant="select"
              isRenderingThumbnails={isRenderingThumbs}
            />

            <div className="flex justify-end">
              <Button
                onClick={handleExtract}
                disabled={selection.selected.size === 0 || isProcessing}
                className="gap-2"
              >
                <FileOutput className="w-4 h-4" />
                {isProcessing ? "Extracting…" : `Extract ${selection.selected.size} page${selection.selected.size !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </ToolLayout>
  );
}
