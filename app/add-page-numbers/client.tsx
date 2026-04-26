"use client";

import { useMemo, useState, useCallback } from "react";
import { FileText, Hash } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addPageNumbers, getPDFPageCount, type AddPageNumbersFormat, type AddPageNumbersPosition } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";
import { usePdfThumbnails } from "@/components/use-pdf-thumbnails";
import { usePageSelection } from "@/components/use-page-selection";
import { PageThumbnailGrid } from "@/components/page-thumbnail-grid";

type ApplyTo = "all" | "selected";

const FORMAT_OPTIONS: { value: AddPageNumbersFormat; label: string }[] = [
  { value: "current-over-total", label: "1 / 10 (default)" },
  { value: "current", label: "1" },
  { value: "page-current", label: "Page 1" },
  { value: "page-current-of-total", label: "Page 1 of 10" },
];

const POSITION_OPTIONS: { value: AddPageNumbersPosition; label: string }[] = [
  { value: "bottom-center", label: "Bottom center (default)" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
];

export function AddPageNumbersClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [applyTo, setApplyTo] = useState<ApplyTo>("all");
  const [format, setFormat] = useState<AddPageNumbersFormat>("current-over-total");
  const [startNumber, setStartNumber] = useState(1);
  const [position, setPosition] = useState<AddPageNumbersPosition>("bottom-center");
  const [fontSize, setFontSize] = useState(11);
  const [margin, setMargin] = useState(24);
  const [color255, setColor255] = useState({ r: 51, g: 51, b: 51 });
  const [isProcessing, setIsProcessing] = useState(false);

  const selection = usePageSelection(pageCount);

  const { urls: thumbUrls, isRendering: isRenderingThumbs, renderedCount: thumbsRendered, reset: resetThumbs } =
    usePdfThumbnails(file, pageCount, { width: 160, maxScale: 1, yieldEvery: 1 });

  const handleDrop = useCallback(
    async (files: File[]) => {
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
    },
    [resetThumbs, selection]
  );

  const selectedIndices = useMemo(
    () => [...selection.selected].sort((a, b) => a - b),
    [selection.selected]
  );

  function clamp255(n: number) {
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  const handleApply = async () => {
    if (!file) return;
    if (applyTo === "selected" && selectedIndices.length === 0) {
      toast.error("Select at least one page.");
      return;
    }
    setIsProcessing(true);
    try {
      const color = {
        r: clamp255(color255.r) / 255,
        g: clamp255(color255.g) / 255,
        b: clamp255(color255.b) / 255,
      };
      const bytes = await addPageNumbers(file, {
        pageIndices: applyTo === "selected" ? selectedIndices : undefined,
        format,
        startNumber: Math.max(1, Math.floor(startNumber || 1)),
        position,
        fontSize: Math.max(6, Math.min(72, Math.floor(fontSize || 11))),
        margin: Math.max(0, Math.floor(margin || 24)),
        color,
      });
      downloadFile(bytes, `${file.name.replace(/\.pdf$/i, "")}-numbered.pdf`);
      toast.success("Page numbers added and downloaded!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add page numbers.";
      toast.error(message.includes("password") ? "This PDF is password-protected and cannot be modified." : message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="Add Page Numbers"
      description="Add simple page numbers to your PDF — all locally in your browser."
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
              className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0"
              onClick={() => {
                resetThumbs();
                setFile(null);
                setPageCount(0);
                selection.reset();
              }}
              disabled={isProcessing}
            >
              Remove
            </button>
          </div>
        )}

        {file && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-800">Numbering options</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Apply to</Label>
                <select
                  value={applyTo}
                  onChange={(e) => setApplyTo(e.target.value as ApplyTo)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  disabled={isProcessing}
                >
                  <option value="all">All pages (default)</option>
                  <option value="selected">Selected pages</option>
                </select>
                {applyTo === "selected" && (
                  <p className="text-xs text-gray-400">
                    Selected pages are numbered sequentially starting at {Math.max(1, Math.floor(startNumber || 1))}.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as AddPageNumbersFormat)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  disabled={isProcessing}
                >
                  {FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Start number</Label>
                <Input
                  type="number"
                  value={startNumber}
                  onChange={(e) => setStartNumber(parseInt(e.target.value || "1", 10))}
                  min={1}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <Label>Position</Label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as AddPageNumbersPosition)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  disabled={isProcessing}
                >
                  {POSITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Font size</Label>
                <Input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value || "11", 10))}
                  min={6}
                  max={72}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <Label>Margin (pt)</Label>
                <Input
                  type="number"
                  value={margin}
                  onChange={(e) => setMargin(parseInt(e.target.value || "24", 10))}
                  min={0}
                  disabled={isProcessing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color (RGB)</Label>
              <div className="grid grid-cols-3 gap-3 max-w-sm">
                <Input
                  type="number"
                  value={color255.r}
                  onChange={(e) => setColor255((prev) => ({ ...prev, r: clamp255(parseInt(e.target.value || "0", 10)) }))}
                  min={0}
                  max={255}
                  disabled={isProcessing}
                />
                <Input
                  type="number"
                  value={color255.g}
                  onChange={(e) => setColor255((prev) => ({ ...prev, g: clamp255(parseInt(e.target.value || "0", 10)) }))}
                  min={0}
                  max={255}
                  disabled={isProcessing}
                />
                <Input
                  type="number"
                  value={color255.b}
                  onChange={(e) => setColor255((prev) => ({ ...prev, b: clamp255(parseInt(e.target.value || "0", 10)) }))}
                  min={0}
                  max={255}
                  disabled={isProcessing}
                />
              </div>
              <p className="text-xs text-gray-400">Default is dark gray (51, 51, 51).</p>
            </div>
          </div>
        )}

        {pageCount > 0 && (
          <>
            {applyTo === "selected" && (
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
                    <Button size="sm" variant="outline" onClick={selection.selectAll} disabled={isProcessing}>
                      All
                    </Button>
                    <Button size="sm" variant="outline" onClick={selection.clearAll} disabled={isProcessing}>
                      None
                    </Button>
                    <Button size="sm" variant="outline" onClick={selection.invertSelection} disabled={isProcessing}>
                      Invert
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => selection.selectOddEven("odd")} disabled={isProcessing}>
                      Odd
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => selection.selectOddEven("even")} disabled={isProcessing}>
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
                    disabled={isProcessing}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const res = selection.applyRange("replace");
                        if (!res.ok && res.error) toast.error(res.error);
                      }}
                      disabled={!selection.rangeInput.trim() || isProcessing}
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
                      disabled={!selection.rangeInput.trim() || isProcessing}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 sm:ml-auto">Tip: shift-click to select a range</p>
                </div>
              </>
            )}

            <PageThumbnailGrid
              pageCount={pageCount}
              thumbnailUrls={thumbUrls}
              selectedPages={applyTo === "selected" ? selection.selected : undefined}
              onPageClick={applyTo === "selected" ? selection.clickPage : undefined}
              variant={applyTo === "selected" ? "select" : "neutral"}
              isRenderingThumbnails={isRenderingThumbs}
            />
          </>
        )}

        {file && (
          <div className="flex justify-end">
            <Button onClick={handleApply} disabled={isProcessing || (applyTo === "selected" && selection.selected.size === 0)} className="gap-2">
              <Hash className="w-4 h-4" />
              {isProcessing ? "Applying…" : "Add page numbers"}
            </Button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}

