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
import { Input } from "@/components/ui/input";
import { usePdfThumbnails } from "@/components/use-pdf-thumbnails";
import { usePageSelection } from "@/components/use-page-selection";
import { PageThumbnailGrid } from "@/components/page-thumbnail-grid";

export function RemovePagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const selection = usePageSelection(pageCount);

  const { urls: thumbUrls, isRendering: isRenderingThumbs, renderedCount: thumbsRendered, reset: resetThumbs } =
    usePdfThumbnails(file, pageCount, { width: 160, maxScale: 1, yieldEvery: 1 });

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

  const remainingCount = pageCount - selection.selected.size;

  const handleExport = async () => {
    if (!file || selection.selected.size === 0 || remainingCount === 0) return;
    setIsProcessing(true);
    try {
      const keepIndices = Array.from({ length: pageCount }, (_, i) => i).filter(
        (i) => !selection.selected.has(i)
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
                  {selection.selected.size > 0
                    ? `${selection.selected.size} page${selection.selected.size !== 1 ? "s" : ""} marked for removal · ${remainingCount} will remain`
                    : `${pageCount} pages · select pages to remove`}
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
              variant="remove"
              isRenderingThumbnails={isRenderingThumbs}
            />

            {remainingCount === 0 && selection.selected.size > 0 && (
              <p className="text-sm text-red-500">
                You have selected all pages. At least one page must remain.
              </p>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleExport}
                disabled={selection.selected.size === 0 || remainingCount === 0 || isProcessing}
                className="gap-2"
              >
                <MinusSquare className="w-4 h-4" />
                {isProcessing
                  ? "Exporting…"
                  : selection.selected.size > 0
                  ? `Export without ${selection.selected.size} page${selection.selected.size !== 1 ? "s" : ""}`
                  : "Select pages to remove"}
              </Button>
            </div>
          </>
        )}
      </div>
    </ToolLayout>
  );
}
