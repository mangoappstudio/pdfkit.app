"use client";

import { useMemo, useState, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { FileText, ImageDown, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { PDF_ACCEPT } from "@/lib/file-utils";
import { downloadBlob } from "@/lib/download";
import { getPDFPageCount } from "@/lib/pdf-utils";
import { usePdfThumbnails } from "@/components/use-pdf-thumbnails";
import { usePageSelection } from "@/components/use-page-selection";
import { PageThumbnailGrid } from "@/components/page-thumbnail-grid";

type ImageFormat = "png" | "jpeg";
type ScalePreset = 1 | 2 | 3;

type PdfJsModule = typeof import("pdfjs-dist");

export function PdfToImagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [jpegQuality, setJpegQuality] = useState(0.85);
  const [scale, setScale] = useState<ScalePreset>(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [renderedCount, setRenderedCount] = useState(0);
  const [totalToRender, setTotalToRender] = useState(0);

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
      setRenderedCount(0);
      setTotalToRender(0);
      try {
        const count = await getPDFPageCount(f);
        setPageCount(count);
        selection.setSelected(new Set(Array.from({ length: count }, (_, i) => i)));
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

  const progressValue = useMemo(() => {
    if (!isProcessing || totalToRender <= 0) return 0;
    return Math.round((renderedCount / totalToRender) * 100);
  }, [isProcessing, renderedCount, totalToRender]);

  const handleExport = async () => {
    if (!file || selectedIndices.length === 0) return;
    setIsProcessing(true);
    setRenderedCount(0);
    setTotalToRender(selectedIndices.length);

    let pdfDoc: PDFDocumentProxy | null = null;
    try {
      const pdfjsLib = (await import("pdfjs-dist")) as PdfJsModule;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await (pdfjsLib.getDocument({ data: arrayBuffer }).promise as Promise<PDFDocumentProxy>);

      const zip = new JSZip();
      const digits = String(selectedIndices.length).length;
      const ext = format === "png" ? "png" : "jpg";

      for (let i = 0; i < selectedIndices.length; i++) {
        const pageIndex = selectedIndices[i]!;
        const page = await pdfDoc.getPage(pageIndex + 1);
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(scaledViewport.width));
        canvas.height = Math.max(1, Math.ceil(scaledViewport.height));

        await page.render({ canvas, viewport: scaledViewport }).promise;

        const blob = await new Promise<Blob>((resolve, reject) => {
          if (format === "png") {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode PNG."))), "image/png");
            return;
          }
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Failed to encode JPEG."))),
            "image/jpeg",
            Math.max(0.01, Math.min(jpegQuality, 1))
          );
        });

        const name = `page-${String(i + 1).padStart(digits, "0")}.${ext}`;
        zip.file(name, blob);
        setRenderedCount(i + 1);
        await new Promise((r) => setTimeout(r, 0));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const baseName = file.name.replace(/\.pdf$/i, "") || "pdf";
      downloadBlob(blob, `${baseName}-pages.zip`);
      toast.success(`Exported ${selectedIndices.length} page${selectedIndices.length !== 1 ? "s" : ""} as images.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export images.";
      toast.error(message.includes("password") ? "This PDF is password-protected and cannot be processed." : message);
    } finally {
      try {
        await pdfDoc?.destroy?.();
      } catch {
        // ignore
      }
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="PDF to Images"
      description="Export selected pages as PNG or JPEG images — all locally in your browser."
    >
      <div className="space-y-6">
        {!file ? (
          <DropZone
            onDrop={handleDrop}
            accept={PDF_ACCEPT}
            multiple={false}
            label="Drop a PDF file here or click to browse"
            sublabel="Exports selected pages as images in a zip"
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
                setRenderedCount(0);
                setTotalToRender(0);
              }}
              disabled={isProcessing}
            >
              Remove
            </button>
          </div>
        )}

        {file && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-800">Export options</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ImageFormat)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  disabled={isProcessing}
                >
                  <option value="png">PNG (default)</option>
                  <option value="jpeg">JPEG</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Scale</Label>
                <select
                  value={String(scale)}
                  onChange={(e) => setScale(parseInt(e.target.value, 10) as ScalePreset)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  disabled={isProcessing}
                >
                  <option value="1">1x (small)</option>
                  <option value="2">2x (default)</option>
                  <option value="3">3x (large)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>JPEG quality</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[jpegQuality]}
                    onValueChange={(v) => setJpegQuality(v[0] ?? 0.85)}
                    min={0.1}
                    max={1}
                    step={0.01}
                    disabled={isProcessing || format !== "jpeg"}
                  />
                  <span className={`text-xs tabular-nums ${format !== "jpeg" ? "text-gray-300" : "text-gray-500"}`}>
                    {jpegQuality.toFixed(2)}
                  </span>
                </div>
                {format !== "jpeg" && <p className="text-xs text-gray-400">Switch to JPEG to enable quality.</p>}
              </div>
            </div>
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

            {isProcessing && totalToRender > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Rendering… {renderedCount}/{totalToRender}
                  </span>
                  <span className="tabular-nums">{progressValue}%</span>
                </div>
                <Progress value={progressValue} />
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleExport}
                disabled={selection.selected.size === 0 || isProcessing}
                className="gap-2"
              >
                <ImageDown className="w-4 h-4" />
                {isProcessing ? "Exporting…" : `Export ${selection.selected.size} page${selection.selected.size !== 1 ? "s" : ""} to zip`}
              </Button>
            </div>
          </>
        )}
      </div>
    </ToolLayout>
  );
}
