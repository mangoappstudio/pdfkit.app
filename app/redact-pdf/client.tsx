"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { EyeOff, ChevronLeft, ChevronRight, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { redactPDF, getPDFPageCount, type RedactionBox } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

interface DrawRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function RedactPDFClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [boxes, setBoxes] = useState<RedactionBox[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  // Drawing state
  const [drawing, setDrawing] = useState(false);
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  // pdfjs page size for coordinate mapping
  const pageInfoRef = useRef<{ width: number; height: number; scale: number }>({
    width: 0,
    height: 0,
    scale: 1,
  });

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setBoxes([]);
    setCurrentPage(0);
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
    }
  }, []);

  // Render page to canvas using pdfjs
  useEffect(() => {
    if (!file || !canvasRef.current) return;

    let cancelled = false;
    setIsRendering(true);

    async function render() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await file!.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdfDoc.getPage(currentPage + 1);

        if (cancelled) return;

        const container = canvasRef.current!.parentElement!;
        const containerWidth = container.clientWidth || 600;
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / viewport.width, 1.5);
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current!;
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;

        const overlay = overlayRef.current!;
        overlay.width = scaledViewport.width;
        overlay.height = scaledViewport.height;
        overlay.style.width = `${scaledViewport.width}px`;
        overlay.style.height = `${scaledViewport.height}px`;

        pageInfoRef.current = {
          width: viewport.width,
          height: viewport.height,
          scale,
        };

        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport: scaledViewport }).promise;

        if (cancelled) return;
        drawOverlay();
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to render page.";
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }

    render();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, currentPage]);

  function drawOverlay() {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const { scale, height: pdfHeight } = pageInfoRef.current;
    const pageBoxes = boxes.filter((b) => b.pageIndex === currentPage);

    for (const b of pageBoxes) {
      // Convert PDF coords (bottom-left) back to canvas coords (top-left)
      const cx = b.x * scale;
      const cy = (pdfHeight - b.y - b.height) * scale;
      const cw = b.width * scale;
      const ch = b.height * scale;
      ctx.fillStyle = "black";
      ctx.fillRect(cx, cy, cw, ch);
    }
  }

  // Redraw overlay when boxes or page changes
  useEffect(() => {
    drawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes, currentPage]);

  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = overlayRef.current!.getBoundingClientRect();
    const scaleX = overlayRef.current!.width / rect.width;
    const scaleY = overlayRef.current!.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getCanvasCoords(e);
    setDrawing(true);
    setDrawRect({ startX: x, startY: y, endX: x, endY: y });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !drawRect) return;
    const { x, y } = getCanvasCoords(e);
    const current = { ...drawRect, endX: x, endY: y };
    setDrawRect(current);

    // Draw live preview
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d")!;
    const { scale, height: pdfHeight } = pageInfoRef.current;

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    // Redraw committed boxes
    const pageBoxes = boxes.filter((b) => b.pageIndex === currentPage);
    for (const b of pageBoxes) {
      const cx = b.x * scale;
      const cy = (pdfHeight - b.y - b.height) * scale;
      ctx.fillStyle = "black";
      ctx.fillRect(cx, cy, b.width * scale, b.height * scale);
    }
    // Draw current selection
    const x1 = Math.min(current.startX, current.endX);
    const y1 = Math.min(current.startY, current.endY);
    const w = Math.abs(current.endX - current.startX);
    const h = Math.abs(current.endY - current.startY);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x1, y1, w, h);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(x1, y1, w, h);
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !drawRect) return;
    setDrawing(false);

    const { x, y } = getCanvasCoords(e);
    const endX = x;
    const endY = y;

    const x1 = Math.min(drawRect.startX, endX);
    const y1 = Math.min(drawRect.startY, endY);
    const w = Math.abs(endX - drawRect.startX);
    const h = Math.abs(endY - drawRect.startY);

    if (w < 4 || h < 4) {
      setDrawRect(null);
      drawOverlay();
      return;
    }

    // Convert canvas coords to PDF coords
    const { scale, height: pdfHeight } = pageInfoRef.current;
    const pdfX = x1 / scale;
    const pdfY = pdfHeight - (y1 + h) / scale;
    const pdfW = w / scale;
    const pdfH = h / scale;

    setBoxes((prev) => [
      ...prev,
      { pageIndex: currentPage, x: pdfX, y: pdfY, width: pdfW, height: pdfH },
    ]);
    setDrawRect(null);
  }

  function clearCurrentPage() {
    setBoxes((prev) => prev.filter((b) => b.pageIndex !== currentPage));
  }

  function clearAll() {
    setBoxes([]);
  }

  const handleExport = async () => {
    if (!file || boxes.length === 0) return;
    setIsProcessing(true);
    try {
      const bytes = await redactPDF(file, boxes);
      downloadFile(bytes, `${file.name.replace(/\.pdf$/i, "")}-redacted.pdf`);
      toast.success("Redacted PDF downloaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply redactions.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentPageBoxes = boxes.filter((b) => b.pageIndex === currentPage).length;
  const totalBoxes = boxes.length;

  return (
    <ToolLayout
      title="Redact PDF"
      description="Draw over sensitive areas to redact them before sharing. Black boxes are applied locally in your browser."
    >
      <div className="space-y-6">
        {!file ? (
          <>
            <DropZone
              onDrop={handleDrop}
              accept={PDF_ACCEPT}
              multiple={false}
              label="Drop a PDF file here or click to browse"
            />
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 font-medium mb-1">About visual redaction</p>
              <p className="text-sm text-amber-700">
                This tool covers selected areas with solid black boxes. The visible content is hidden.
                For documents requiring certified redaction, consult a professional tool. See our{" "}
                <a href="/privacy" className="underline hover:no-underline">privacy page</a> for details.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">
                  {pageCount} pages · {totalBoxes} redaction{totalBoxes !== 1 ? "s" : ""} applied
                </p>
              </div>
              <button
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                onClick={() => { setFile(null); setPageCount(0); setBoxes([]); setCurrentPage(0); }}
              >
                Remove
              </button>
            </div>

            {/* Page navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0 || isRendering}
                  className="p-1.5 rounded border border-gray-200 text-gray-600 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage + 1} of {pageCount}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={currentPage === pageCount - 1 || isRendering}
                  className="p-1.5 rounded border border-gray-200 text-gray-600 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {currentPageBoxes > 0 && (
                  <span className="text-xs text-gray-500 ml-1">
                    · {currentPageBoxes} box{currentPageBoxes !== 1 ? "es" : ""} on this page
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {currentPageBoxes > 0 && (
                  <button
                    onClick={clearCurrentPage}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear page
                  </button>
                )}
                {totalBoxes > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Canvas area */}
            <div className="bg-gray-100 rounded-xl overflow-auto p-4">
              <div className="relative inline-block select-none">
                {isRendering && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded">
                    <span className="text-sm text-gray-500">Rendering…</span>
                  </div>
                )}
                {/* PDF render canvas */}
                <canvas ref={canvasRef} className="block shadow-sm rounded" />
                {/* Drawing overlay canvas */}
                <canvas
                  ref={overlayRef}
                  className="absolute inset-0 cursor-crosshair"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={(e) => {
                    if (drawing) handleMouseUp(e);
                  }}
                />
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Click and drag to draw a redaction box. Boxes are applied as solid black areas when exported.
            </p>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                {totalBoxes > 0
                  ? `${totalBoxes} redaction${totalBoxes !== 1 ? "s" : ""} across ${new Set(boxes.map((b) => b.pageIndex)).size} page${new Set(boxes.map((b) => b.pageIndex)).size !== 1 ? "s" : ""}`
                  : "Draw boxes over areas to redact"}
              </p>
              <Button
                onClick={handleExport}
                disabled={totalBoxes === 0 || isProcessing}
                className="gap-2"
              >
                <EyeOff className="w-4 h-4" />
                {isProcessing ? "Applying…" : "Export redacted PDF"}
              </Button>
            </div>
          </>
        )}
      </div>
    </ToolLayout>
  );
}
