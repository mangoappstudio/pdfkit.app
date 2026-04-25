"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  EyeOff,
  FileText,
  Loader2,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { redactPDF, getPDFPageCount, type RedactionBox } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";
import { Slider } from "@/components/ui/slider";
import { usePdfThumbnails } from "@/components/use-pdf-thumbnails";
import { generateId } from "@/lib/file-utils";

interface DrawRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

type UiRedactionBox = RedactionBox & { id: string };

type Interaction =
  | null
  | {
      type: "draw";
      startX: number;
      startY: number;
    }
  | {
      type: "move";
      boxId: string;
      startX: number;
      startY: number;
      original: UiRedactionBox;
    }
  | {
      type: "resize";
      boxId: string;
      handle: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      originalCanvas: { x: number; y: number; w: number; h: number };
    };

export function RedactPDFClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [boxes, setBoxes] = useState<UiRedactionBox[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [flattenExport, setFlattenExport] = useState(true);

  // Drawing state
  const [interaction, setInteraction] = useState<Interaction>(null);
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  // pdfjs page size for coordinate mapping
  const pageInfoRef = useRef<{ width: number; height: number; scale: number; baseScale: number }>({
    width: 0,
    height: 0,
    scale: 1,
    baseScale: 1,
  });

  const undoStackRef = useRef<UiRedactionBox[][]>([]);
  const redoStackRef = useRef<UiRedactionBox[][]>([]);
  const copiedBoxesRef = useRef<UiRedactionBox[] | null>(null);

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setBoxes([]);
    setCurrentPage(0);
    setActiveBoxId(null);
    setDrawRect(null);
    setInteraction(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    copiedBoxesRef.current = null;
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
      setPageCount(0);
    }
  }, []);

  const { urls: thumbUrls, isRendering: isRenderingThumbs, renderedCount: thumbsRendered, reset: resetThumbs } =
    usePdfThumbnails(file, pageCount, { width: 120, maxScale: 1, yieldEvery: 2 });

  function pushUndo(snapshot: UiRedactionBox[]) {
    undoStackRef.current.push(snapshot.map((b) => ({ ...b })));
    redoStackRef.current = [];
  }

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  // Render page to canvas using pdfjs
  useEffect(() => {
    if (!file || !canvasRef.current) return;

    const fileForRender = file;
    let cancelled = false;
    setIsRendering(true);

    async function render() {
      let pdfDoc: PDFDocumentProxy | null = null;
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await fileForRender.arrayBuffer();
        pdfDoc = await (pdfjsLib.getDocument({ data: arrayBuffer }).promise as Promise<PDFDocumentProxy>);
        const page = await pdfDoc.getPage(currentPage + 1);

        if (cancelled) return;

        const container = canvasRef.current!.parentElement!;
        const containerWidth = container.clientWidth || 600;
        const viewport = page.getViewport({ scale: 1 });
        const baseScale = Math.min(containerWidth / viewport.width, 1.5);
        const scale = Math.max(0.25, Math.min(baseScale * zoom, 4));
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
          baseScale,
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
        try {
          await pdfDoc?.destroy?.();
        } catch {
          // ignore
        }
        if (!cancelled) setIsRendering(false);
      }
    }

    render();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, currentPage, zoom]);

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

      if (b.id === activeBoxId) {
        ctx.save();
        ctx.strokeStyle = "rgba(59,130,246,0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx + 1, cy + 1, Math.max(0, cw - 2), Math.max(0, ch - 2));
        const hs = 6;
        ctx.fillStyle = "white";
        ctx.strokeStyle = "rgba(59,130,246,0.9)";
        const handles = [
          { x: cx, y: cy }, // nw
          { x: cx + cw, y: cy }, // ne
          { x: cx, y: cy + ch }, // sw
          { x: cx + cw, y: cy + ch }, // se
        ];
        handles.forEach((h) => {
          ctx.beginPath();
          ctx.rect(h.x - hs, h.y - hs, hs * 2, hs * 2);
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      }
    }
  }

  // Redraw overlay when boxes or page changes
  useEffect(() => {
    drawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes, currentPage, activeBoxId]);

  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = overlayRef.current!.getBoundingClientRect();
    const scaleX = overlayRef.current!.width / rect.width;
    const scaleY = overlayRef.current!.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function boxToCanvasRect(b: UiRedactionBox) {
    const { scale, height: pdfHeight } = pageInfoRef.current;
    const x = b.x * scale;
    const y = (pdfHeight - b.y - b.height) * scale;
    const w = b.width * scale;
    const h = b.height * scale;
    return { x, y, w, h };
  }

  function canvasRectToPdfRect(rect: { x: number; y: number; w: number; h: number }) {
    const { scale, height: pdfHeight } = pageInfoRef.current;
    const pdfX = rect.x / scale;
    const pdfY = pdfHeight - (rect.y + rect.h) / scale;
    const pdfW = rect.w / scale;
    const pdfH = rect.h / scale;
    return { x: pdfX, y: pdfY, width: pdfW, height: pdfH };
  }

  function getHandleAtPoint(rect: { x: number; y: number; w: number; h: number }, x: number, y: number) {
    const hs = 10;
    const corners = {
      nw: { x: rect.x, y: rect.y },
      ne: { x: rect.x + rect.w, y: rect.y },
      sw: { x: rect.x, y: rect.y + rect.h },
      se: { x: rect.x + rect.w, y: rect.y + rect.h },
    } as const;
    for (const key of Object.keys(corners) as Array<keyof typeof corners>) {
      const c = corners[key];
      if (Math.abs(x - c.x) <= hs && Math.abs(y - c.y) <= hs) return key;
    }
    return null;
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getCanvasCoords(e);
    const pageBoxes = boxes.filter((b) => b.pageIndex === currentPage);
    for (let i = pageBoxes.length - 1; i >= 0; i--) {
      const b = pageBoxes[i]!;
      const rect = boxToCanvasRect(b);
      const handle = getHandleAtPoint(rect, x, y);
      const inside =
        x >= rect.x &&
        x <= rect.x + rect.w &&
        y >= rect.y &&
        y <= rect.y + rect.h;
      if (handle) {
        setActiveBoxId(b.id);
        pushUndo(boxes);
        setInteraction({ type: "resize", boxId: b.id, handle, startX: x, startY: y, originalCanvas: rect });
        return;
      }
      if (inside) {
        setActiveBoxId(b.id);
        pushUndo(boxes);
        setInteraction({ type: "move", boxId: b.id, startX: x, startY: y, original: { ...b } });
        return;
      }
    }

    setActiveBoxId(null);
    setInteraction({ type: "draw", startX: x, startY: y });
    setDrawRect({ startX: x, startY: y, endX: x, endY: y });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!interaction) return;
    const { x, y } = getCanvasCoords(e);

    if (interaction.type === "draw" && drawRect) {
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
      return;
    }

    if (interaction.type === "move") {
      const { scale, width: pdfW, height: pdfH } = pageInfoRef.current;
      const dxPdf = (x - interaction.startX) / scale;
      const dyPdf = -(y - interaction.startY) / scale;
      setBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== interaction.boxId) return b;
          const nx = Math.max(0, Math.min(pdfW - interaction.original.width, interaction.original.x + dxPdf));
          const ny = Math.max(0, Math.min(pdfH - interaction.original.height, interaction.original.y + dyPdf));
          return { ...b, x: nx, y: ny };
        })
      );
      return;
    }

    if (interaction.type === "resize") {
      const r = { ...interaction.originalCanvas };
      const minSize = 6;
      if (interaction.handle === "nw") {
        const nx = Math.min(r.x + r.w - minSize, x);
        const ny = Math.min(r.y + r.h - minSize, y);
        r.w = r.x + r.w - nx;
        r.h = r.y + r.h - ny;
        r.x = nx;
        r.y = ny;
      } else if (interaction.handle === "ne") {
        const ny = Math.min(r.y + r.h - minSize, y);
        const nw = Math.max(minSize, x - r.x);
        r.h = r.y + r.h - ny;
        r.y = ny;
        r.w = nw;
      } else if (interaction.handle === "sw") {
        const nx = Math.min(r.x + r.w - minSize, x);
        const nh = Math.max(minSize, y - r.y);
        r.w = r.x + r.w - nx;
        r.x = nx;
        r.h = nh;
      } else if (interaction.handle === "se") {
        r.w = Math.max(minSize, x - r.x);
        r.h = Math.max(minSize, y - r.y);
      }

      const pdfRect = canvasRectToPdfRect(r);
      setBoxes((prev) =>
        prev.map((b) => (b.id === interaction.boxId ? { ...b, ...pdfRect } : b))
      );
      return;
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!interaction) return;
    if (interaction.type !== "draw" || !drawRect) {
      setInteraction(null);
      return;
    }

    const { x, y } = getCanvasCoords(e);
    const endX = x;
    const endY = y;

    const x1 = Math.min(drawRect.startX, endX);
    const y1 = Math.min(drawRect.startY, endY);
    const w = Math.abs(endX - drawRect.startX);
    const h = Math.abs(endY - drawRect.startY);

    if (w < 4 || h < 4) {
      setDrawRect(null);
      setInteraction(null);
      drawOverlay();
      return;
    }

    // Convert canvas coords to PDF coords
    const { scale, height: pdfHeight } = pageInfoRef.current;
    const pdfX = x1 / scale;
    const pdfY = pdfHeight - (y1 + h) / scale;
    const pdfW = w / scale;
    const pdfH = h / scale;

    pushUndo(boxes);
    setBoxes((prev) => [
      ...prev,
      { id: generateId(), pageIndex: currentPage, x: pdfX, y: pdfY, width: pdfW, height: pdfH },
    ]);
    setDrawRect(null);
    setInteraction(null);
  }

  function clearCurrentPage() {
    if (boxes.some((b) => b.pageIndex === currentPage)) pushUndo(boxes);
    setBoxes((prev) => prev.filter((b) => b.pageIndex !== currentPage));
    if (activeBoxId && boxes.find((b) => b.id === activeBoxId)?.pageIndex === currentPage) {
      setActiveBoxId(null);
    }
  }

  function clearAll() {
    if (boxes.length > 0) pushUndo(boxes);
    setBoxes([]);
    setActiveBoxId(null);
  }

  const handleExport = async () => {
    if (!file || boxes.length === 0) return;
    setIsProcessing(true);
    try {
      if (!flattenExport) {
        const bytes = await redactPDF(
          file,
          boxes.map((b) => ({
            pageIndex: b.pageIndex,
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
          }))
        );
        downloadFile(bytes, `${file.name.replace(/\.pdf$/i, "")}-redacted.pdf`);
        toast.success("Redacted PDF downloaded.");
        return;
      }

      const arrayBuffer = await file.arrayBuffer();

      const srcPdf = await PDFDocument.load(arrayBuffer);
      const outPdf = await PDFDocument.create();

      const boxesByPage = new Map<number, UiRedactionBox[]>();
      boxes.forEach((b) => {
        const list = boxesByPage.get(b.pageIndex) ?? [];
        list.push(b);
        boxesByPage.set(b.pageIndex, list);
      });

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const rasterScale = 2;
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const pageBoxes = boxesByPage.get(pageIndex);
        if (!pageBoxes || pageBoxes.length === 0) {
          const [copied] = await outPdf.copyPages(srcPdf, [pageIndex]);
          outPdf.addPage(copied);
          continue;
        }

        const page = await pdfjsDoc.getPage(pageIndex + 1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scaledViewport = page.getViewport({ scale: rasterScale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(scaledViewport.width));
        canvas.height = Math.max(1, Math.ceil(scaledViewport.height));
        await page.render({ canvas, viewport: scaledViewport }).promise;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context.");
        ctx.fillStyle = "black";
        for (const b of pageBoxes) {
          const cx = b.x * rasterScale;
          const cy = (baseViewport.height - b.y - b.height) * rasterScale;
          const cw = b.width * rasterScale;
          const ch = b.height * rasterScale;
          ctx.fillRect(cx, cy, cw, ch);
        }

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((bl) => (bl ? resolve(bl) : reject(new Error("Failed to encode page image."))), "image/png");
        });

        const pngBytes = await blob.arrayBuffer();
        const img = await outPdf.embedPng(pngBytes);
        const outPage = outPdf.addPage([baseViewport.width, baseViewport.height]);
        outPage.drawImage(img, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
      }

      try {
        await pdfjsDoc?.destroy?.();
      } catch {
        // ignore
      }

      const bytes = await outPdf.save();
      downloadFile(bytes, `${file.name.replace(/\.pdf$/i, "")}-redacted-flattened.pdf`);
      toast.success("Flattened redaction exported and downloaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply redactions.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  function undo() {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(boxes.map((b) => ({ ...b })));
    setBoxes(prev);
    setActiveBoxId(null);
    setInteraction(null);
    setDrawRect(null);
  }

  function redo() {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(boxes.map((b) => ({ ...b })));
    setBoxes(next);
    setActiveBoxId(null);
    setInteraction(null);
    setDrawRect(null);
  }

  function copyCurrentPageBoxes() {
    const pageBoxes = boxes.filter((b) => b.pageIndex === currentPage);
    if (pageBoxes.length === 0) {
      toast.message("No boxes on this page to copy.");
      return;
    }
    copiedBoxesRef.current = pageBoxes.map((b) => ({ ...b }));
    toast.success(`Copied ${pageBoxes.length} box${pageBoxes.length !== 1 ? "es" : ""}.`);
  }

  function pasteToCurrentPage() {
    if (!copiedBoxesRef.current || copiedBoxesRef.current.length === 0) {
      toast.message("Nothing copied yet.");
      return;
    }
    pushUndo(boxes);
    const pasted = copiedBoxesRef.current.map((b) => ({
      ...b,
      id: generateId(),
      pageIndex: currentPage,
    }));
    setBoxes((prev) => [...prev, ...pasted]);
    toast.success(`Pasted ${pasted.length} box${pasted.length !== 1 ? "es" : ""}.`);
  }

  const boxCounts = useMemo(() => {
    const map = new Map<number, number>();
    boxes.forEach((b) => map.set(b.pageIndex, (map.get(b.pageIndex) ?? 0) + 1));
    return map;
  }, [boxes]);

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
                onClick={() => {
                  resetThumbs();
                  setFile(null);
                  setPageCount(0);
                  setBoxes([]);
                  setCurrentPage(0);
                  setActiveBoxId(null);
                  setInteraction(null);
                  setDrawRect(null);
                  undoStackRef.current = [];
                  redoStackRef.current = [];
                  copiedBoxesRef.current = null;
                }}
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[190px_1fr] gap-4">
              {/* Sidebar */}
              <aside className="bg-white border border-gray-200 rounded-xl p-3 max-h-[70vh] overflow-auto">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">Pages</p>
                  {isRenderingThumbs && (
                    <span className="text-xs text-gray-400">
                      {thumbsRendered}/{pageCount}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-6 lg:grid-cols-1 gap-2">
                  {Array.from({ length: pageCount }, (_, i) => {
                    const count = boxCounts.get(i) ?? 0;
                    const isActive = i === currentPage;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setCurrentPage(i);
                          setActiveBoxId(null);
                          setInteraction(null);
                          setDrawRect(null);
                        }}
                        className={`relative rounded-lg border-2 overflow-hidden aspect-[3/4] lg:aspect-auto lg:flex lg:items-center lg:gap-2 lg:p-2 transition-all ${
                          isActive ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                        type="button"
                        aria-label={`Go to page ${i + 1}`}
                      >
                        <div className="w-full h-full lg:w-10 lg:h-14 bg-gray-50 border border-gray-200 rounded overflow-hidden flex items-center justify-center">
                          {thumbUrls[i] ? (
                            <img
                              src={thumbUrls[i]!}
                              alt={`Page ${i + 1}`}
                              className="w-full h-full object-contain bg-white"
                              draggable={false}
                            />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 text-gray-300 animate-spin" aria-hidden="true" />
                          )}
                        </div>
                        <div className="hidden lg:flex flex-1 items-center justify-between min-w-0">
                          <span className="text-sm text-gray-700">p. {i + 1}</span>
                          {count > 0 && (
                            <span className="text-xs text-gray-500">{count}</span>
                          )}
                        </div>
                        {count > 0 && (
                          <span className="absolute top-1 right-1 lg:hidden text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* Main */}
              <section className="space-y-4">
                {/* Top controls */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={undo} disabled={!canUndo}>
                        <Undo2 className="w-4 h-4" />
                        Undo
                      </Button>
                      <Button size="sm" variant="outline" onClick={redo} disabled={!canRedo}>
                        <Redo2 className="w-4 h-4" />
                        Redo
                      </Button>
                      <Button size="sm" variant="outline" onClick={copyCurrentPageBoxes} disabled={currentPageBoxes === 0}>
                        <ClipboardCopy className="w-4 h-4" />
                        Copy page
                      </Button>
                      <Button size="sm" variant="outline" onClick={pasteToCurrentPage} disabled={!copiedBoxesRef.current || copiedBoxesRef.current.length === 0}>
                        <ClipboardPaste className="w-4 h-4" />
                        Paste
                      </Button>
                      <Button size="sm" variant="outline" onClick={clearCurrentPage} disabled={currentPageBoxes === 0}>
                        <Trash2 className="w-4 h-4" />
                        Clear page
                      </Button>
                      <Button size="sm" variant="outline" onClick={clearAll} disabled={totalBoxes === 0}>
                        Clear all
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={flattenExport ? "default" : "outline"}
                        onClick={() => setFlattenExport(true)}
                      >
                        Flattened
                      </Button>
                      <Button
                        size="sm"
                        variant={!flattenExport ? "default" : "outline"}
                        onClick={() => setFlattenExport(false)}
                      >
                        Overlay only
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                        disabled={zoom <= 0.5}
                      >
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-600 w-16 text-center">{Math.round(zoom * 100)}%</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 10) / 10))}
                        disabled={zoom >= 3}
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex-1">
                      <Slider min={0.5} max={3} step={0.1} value={[zoom]} onValueChange={([v]) => setZoom(v)} />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={currentPage === 0 || isRendering}
                        className="p-1.5 rounded border border-gray-200 text-gray-600 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Previous page"
                        type="button"
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
                        type="button"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {currentPageBoxes > 0 && (
                        <span className="text-xs text-gray-500 ml-1">
                          · {currentPageBoxes} box{currentPageBoxes !== 1 ? "es" : ""} on this page
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Canvas area */}
                <div className="bg-gray-100 rounded-xl overflow-auto p-4">
                  <div className="relative inline-block select-none">
                    {isRendering && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded">
                        <span className="text-sm text-gray-500 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          Rendering…
                        </span>
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
                        if (interaction && interaction.type === "draw") handleMouseUp(e);
                        setInteraction(null);
                        setDrawRect(null);
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  Drag to draw a box. Click a box to select it, drag to move, and use corner handles to resize.
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
                    {isProcessing ? "Applying…" : flattenExport ? "Export flattened redaction" : "Export redacted PDF"}
                  </Button>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </ToolLayout>
  );
}
