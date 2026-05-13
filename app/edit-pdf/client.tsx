"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import {
  Brush,
  Download,
  FileText,
  Loader2,
  MousePointer2,
  PencilLine,
  Square,
  Trash2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { usePdfThumbnails } from "@/components/use-pdf-thumbnails";
import { downloadFile } from "@/lib/download";
import { generateId, PDF_ACCEPT } from "@/lib/file-utils";

type ToolMode = "select" | "whiteout" | "addText" | "editText" | "draw";

type Rgb = { r: number; g: number; b: number };

type RectEditBase = {
  id: string;
  pageIndex: number;
  x: number; // PDF points from bottom-left
  y: number; // PDF points from bottom-left
  width: number; // PDF points
  height: number; // PDF points
};

type WhiteoutEdit = RectEditBase & {
  type: "whiteout";
};

type TextEdit = RectEditBase & {
  type: "text";
  text: string;
  font: "Helvetica" | "TimesRoman" | "Courier";
  fontSize: number; // PDF points
  color: Rgb;
  background: boolean;
};

type StrokeEdit = {
  id: string;
  pageIndex: number;
  type: "stroke";
  points: Array<{ x: number; y: number }>; // PDF points
  thickness: number; // PDF points
  color: Rgb;
};

type EditItem = WhiteoutEdit | TextEdit | StrokeEdit;

type Interaction =
  | null
  | {
      type: "drawRect";
      startX: number;
      startY: number;
    }
  | {
      type: "moveRect";
      editId: string;
      startX: number;
      startY: number;
      original: RectEditBase;
    }
  | {
      type: "resizeRect";
      editId: string;
      handle: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      originalCanvas: { x: number; y: number; w: number; h: number };
    }
  | {
      type: "stroke";
      editId: string;
    };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fileBaseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

function normalizeRect(r: { x: number; y: number; w: number; h: number }) {
  const x = Math.min(r.x, r.x + r.w);
  const y = Math.min(r.y, r.y + r.h);
  const w = Math.abs(r.w);
  const h = Math.abs(r.h);
  return { x, y, w, h };
}

function parseCssRgb(input: string): Rgb {
  const m = input.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: Number(m[1]) / 255, g: Number(m[2]) / 255, b: Number(m[3]) / 255 };
}

function wrapTextLines(args: { text: string; maxWidthPx: number; measure: (t: string) => number }) {
  const { text, maxWidthPx, measure } = args;
  const tokens = text.replace(/\\s+/g, " ").trim().split(" ").filter(Boolean);
  if (tokens.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const token of tokens) {
    const attempt = current ? `${current} ${token}` : token;
    if (measure(attempt) <= maxWidthPx || !current) {
      current = attempt;
      continue;
    }
    lines.push(current);
    current = token;
  }
  if (current) lines.push(current);
  return lines;
}

export function EditPDFClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<ToolMode>("select");
  const [edits, setEdits] = useState<EditItem[]>([]);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const undoStackRef = useRef<EditItem[][]>([]);
  const redoStackRef = useRef<EditItem[][]>([]);

  const pageInfoRef = useRef<{ width: number; height: number; scale: number; baseScale: number }>({
    width: 0,
    height: 0,
    scale: 1,
    baseScale: 1,
  });

  const activeEdit = useMemo(() => edits.find((e) => e.id === activeEditId) ?? null, [edits, activeEditId]);
  const activeRectEdit = (activeEdit?.type === "whiteout" || activeEdit?.type === "text") ? activeEdit : null;

  function pushUndo(snapshot: EditItem[]) {
    undoStackRef.current.push(snapshot.map((e) => structuredClone(e)));
    redoStackRef.current = [];
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(0);
  }

  const canUndo = undoDepth > 0;
  const canRedo = redoDepth > 0;

  const { urls: thumbUrls, isRendering: isRenderingThumbs, renderedCount: thumbsRendered, reset: resetThumbs } =
    usePdfThumbnails(file, pageCount, { width: 120, maxScale: 1, yieldEvery: 2 });

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setEdits([]);
    setActiveEditId(null);
    setCurrentPage(0);
    setZoom(1);
    setMode("select");
    setInteraction(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoDepth(0);
    setRedoDepth(0);
    resetThumbs();

    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const arrayBuffer = await f.arrayBuffer();
      const pdfDoc = await (pdfjsLib.getDocument({ data: arrayBuffer }).promise as Promise<PDFDocumentProxy>);
      setPageCount(pdfDoc.numPages ?? 0);
      try {
        await pdfDoc.destroy?.();
      } catch {
        // ignore
      }
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
      setPageCount(0);
    }
  }, [resetThumbs]);

  const currentPageEdits = useMemo(() => edits.filter((e) => e.pageIndex === currentPage), [edits, currentPage]);

  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = overlayRef.current!.getBoundingClientRect();
    const scaleX = overlayRef.current!.width / rect.width;
    const scaleY = overlayRef.current!.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function rectToCanvasRect(r: RectEditBase) {
    const { scale, height: pdfHeight } = pageInfoRef.current;
    const x = r.x * scale;
    const y = (pdfHeight - r.y - r.height) * scale;
    const w = r.width * scale;
    const h = r.height * scale;
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

  function drawOverlay() {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const { scale, height: pdfHeight } = pageInfoRef.current;
    for (const e of currentPageEdits) {
      if (e.type === "stroke") {
        if (e.points.length < 2) continue;
        ctx.save();
        ctx.strokeStyle = `rgb(${Math.round(e.color.r * 255)},${Math.round(e.color.g * 255)},${Math.round(
          e.color.b * 255
        )})`;
        ctx.lineWidth = Math.max(1, e.thickness * scale);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        const first = e.points[0]!;
        ctx.moveTo(first.x * scale, (pdfHeight - first.y) * scale);
        for (let i = 1; i < e.points.length; i++) {
          const p = e.points[i]!;
          ctx.lineTo(p.x * scale, (pdfHeight - p.y) * scale);
        }
        ctx.stroke();
        ctx.restore();
        continue;
      }

      const rect = rectToCanvasRect(e);
      if (e.type === "whiteout") {
        ctx.fillStyle = "white";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      } else if (e.type === "text") {
        if (e.background) {
          ctx.fillStyle = "white";
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.clip();
        const fontPx = Math.max(6, e.fontSize * scale);
        ctx.font = `${fontPx}px ${e.font === "Courier" ? "monospace" : e.font === "TimesRoman" ? "serif" : "sans-serif"}`;
        ctx.fillStyle = `rgb(${Math.round(e.color.r * 255)},${Math.round(e.color.g * 255)},${Math.round(
          e.color.b * 255
        )})`;
        const padding = 4 * scale;
        const lines = wrapTextLines({
          text: e.text,
          maxWidthPx: Math.max(10, rect.w - padding * 2),
          measure: (t) => ctx.measureText(t).width,
        });
        const lineHeight = fontPx * 1.15;
        let y = rect.y + padding + fontPx;
        for (const line of lines) {
          if (y > rect.y + rect.h - padding) break;
          ctx.fillText(line, rect.x + padding, y);
          y += lineHeight;
        }
        ctx.restore();
      }

      if (e.id === activeEditId) {
        ctx.save();
        ctx.strokeStyle = "rgba(59,130,246,0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x + 1, rect.y + 1, Math.max(0, rect.w - 2), Math.max(0, rect.h - 2));
        const hs = 6;
        ctx.fillStyle = "white";
        ctx.strokeStyle = "rgba(59,130,246,0.9)";
        const handles = [
          { x: rect.x, y: rect.y }, // nw
          { x: rect.x + rect.w, y: rect.y }, // ne
          { x: rect.x, y: rect.y + rect.h }, // sw
          { x: rect.x + rect.w, y: rect.y + rect.h }, // se
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

  useEffect(() => {
    drawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, currentPage, activeEditId]);

  // Render current page and text layer with pdf.js
  useEffect(() => {
    if (!file || !canvasRef.current || !overlayRef.current || !textLayerRef.current) return;
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
        const containerWidth = container.clientWidth || 900;

        const viewport = page.getViewport({ scale: 1 });
        const baseScale = Math.min(containerWidth / viewport.width, 1.5);
        const scale = clamp(baseScale * zoom, 0.25, 4);
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current!;
        canvas.width = Math.max(1, Math.ceil(scaledViewport.width));
        canvas.height = Math.max(1, Math.ceil(scaledViewport.height));
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;

        const overlay = overlayRef.current!;
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        overlay.style.width = canvas.style.width;
        overlay.style.height = canvas.style.height;

        const textLayer = textLayerRef.current!;
        textLayer.style.width = canvas.style.width;
        textLayer.style.height = canvas.style.height;
        textLayer.innerHTML = "";

        pageInfoRef.current = { width: viewport.width, height: viewport.height, scale, baseScale };

        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport: scaledViewport }).promise;
        if (cancelled) return;

        const textContent = await page.getTextContent();
        if (cancelled) return;
        const layer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport: scaledViewport,
        });
        await layer.render();

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
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, currentPage, zoom]);

  const onTextLayerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (mode !== "editText") return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // TextLayer renders spans; only act on leaf spans with text.
      const span = target.closest("span");
      if (!span || !textLayerRef.current) return;
      const text = (span.textContent ?? "").trim();
      if (!text) return;

      const spanRect = span.getBoundingClientRect();
      const containerRect = textLayerRef.current.getBoundingClientRect();
      const x = spanRect.left - containerRect.left;
      const y = spanRect.top - containerRect.top;
      const w = spanRect.width;
      const h = spanRect.height;

      const { scale } = pageInfoRef.current;
      const { x: pdfX, y: pdfY, width: pdfW, height: pdfH } = canvasRectToPdfRect({ x, y, w, h });

      const computed = window.getComputedStyle(span);
      const fontSizePx = Number.parseFloat(computed.fontSize || "12") || 12;
      const guessedFontSize = clamp(fontSizePx / scale, 6, 72);

      pushUndo(edits);
      const id = generateId();
      const newEdit: TextEdit = {
        id,
        type: "text",
        pageIndex: currentPage,
        x: pdfX,
        y: pdfY,
        width: Math.max(20, pdfW),
        height: Math.max(12, pdfH),
        text,
        font: "Helvetica",
        fontSize: guessedFontSize,
        color: parseCssRgb(computed.color),
        background: true,
      };
      setEdits((prev) => [...prev, newEdit]);
      setActiveEditId(id);
      toast.message("Editing text: changes are applied as an overlay (original text is covered).");
    },
    [mode, edits, currentPage]
  );

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mode === "editText") return; // handled by text layer clicks
    const { x, y } = getCanvasCoords(e);

    if (mode === "draw") {
      pushUndo(edits);
      const id = generateId();
      const { scale, height: pdfHeight } = pageInfoRef.current;
      const pdfX = x / scale;
      const pdfY = pdfHeight - y / scale;
      const stroke: StrokeEdit = {
        id,
        pageIndex: currentPage,
        type: "stroke",
        points: [{ x: pdfX, y: pdfY }],
        thickness: 2,
        color: { r: 0, g: 0, b: 0 },
      };
      setEdits((prev) => [...prev, stroke]);
      setActiveEditId(null);
      setInteraction({ type: "stroke", editId: id });
      return;
    }

    // Select/move/resize existing rect edits (text + whiteout)
    const pageRectEdits = currentPageEdits.filter((ed) => ed.type === "whiteout" || ed.type === "text") as Array<
      WhiteoutEdit | TextEdit
    >;
    for (let i = pageRectEdits.length - 1; i >= 0; i--) {
      const ed = pageRectEdits[i]!;
      const rect = rectToCanvasRect(ed);
      const handle = getHandleAtPoint(rect, x, y);
      const inside = x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
      if (handle) {
        setActiveEditId(ed.id);
        pushUndo(edits);
        setInteraction({ type: "resizeRect", editId: ed.id, handle, startX: x, startY: y, originalCanvas: rect });
        return;
      }
      if (inside && mode === "select") {
        setActiveEditId(ed.id);
        pushUndo(edits);
        setInteraction({ type: "moveRect", editId: ed.id, startX: x, startY: y, original: { ...ed } });
        return;
      }
    }

    setActiveEditId(null);
    if (mode === "whiteout" || mode === "addText") {
      setInteraction({ type: "drawRect", startX: x, startY: y });
      return;
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!interaction) return;
    const { x, y } = getCanvasCoords(e);

    if (interaction.type === "stroke") {
      const { scale, height: pdfHeight } = pageInfoRef.current;
      const pdfX = x / scale;
      const pdfY = pdfHeight - y / scale;
      setEdits((prev) =>
        prev.map((ed) => {
          if (ed.id !== interaction.editId || ed.type !== "stroke") return ed;
          return { ...ed, points: [...ed.points, { x: pdfX, y: pdfY }] };
        })
      );
      return;
    }

    if (interaction.type === "drawRect") {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      drawOverlay();

      const rect = normalizeRect({ x: interaction.startX, y: interaction.startY, w: x - interaction.startX, h: y - interaction.startY });
      ctx.save();
      ctx.fillStyle = mode === "whiteout" ? "rgba(255,255,255,0.85)" : "rgba(59,130,246,0.08)";
      ctx.strokeStyle = mode === "whiteout" ? "rgba(0,0,0,0.25)" : "rgba(59,130,246,0.6)";
      ctx.lineWidth = 1;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
      return;
    }

    if (interaction.type === "moveRect") {
      const { scale, width: pdfW, height: pdfH } = pageInfoRef.current;
      const dxPdf = (x - interaction.startX) / scale;
      const dyPdf = -(y - interaction.startY) / scale;
      const next = {
        x: clamp(interaction.original.x + dxPdf, 0, Math.max(0, pdfW - interaction.original.width)),
        y: clamp(interaction.original.y + dyPdf, 0, Math.max(0, pdfH - interaction.original.height)),
      };
      setEdits((prev) =>
        prev.map((ed) => {
          if (ed.id !== interaction.editId) return ed;
          if (ed.type !== "whiteout" && ed.type !== "text") return ed;
          return { ...ed, ...next };
        })
      );
      return;
    }

    if (interaction.type === "resizeRect") {
      const { width: pdfW, height: pdfH } = pageInfoRef.current;
      const dx = x - interaction.startX;
      const dy = y - interaction.startY;
      const o = interaction.originalCanvas;
      let x1 = o.x;
      let y1 = o.y;
      let x2 = o.x + o.w;
      let y2 = o.y + o.h;
      if (interaction.handle === "nw") {
        x1 += dx;
        y1 += dy;
      } else if (interaction.handle === "ne") {
        x2 += dx;
        y1 += dy;
      } else if (interaction.handle === "sw") {
        x1 += dx;
        y2 += dy;
      } else if (interaction.handle === "se") {
        x2 += dx;
        y2 += dy;
      }
      const rect = normalizeRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
      const pdf = canvasRectToPdfRect(rect);
      const minW = 8;
      const minH = 8;
      setEdits((prev) =>
        prev.map((ed) => {
          if (ed.id !== interaction.editId) return ed;
          if (ed.type !== "whiteout" && ed.type !== "text") return ed;
          return {
            ...ed,
            x: clamp(pdf.x, 0, pdfW - minW),
            y: clamp(pdf.y, 0, pdfH - minH),
            width: clamp(pdf.width, minW, pdfW),
            height: clamp(pdf.height, minH, pdfH),
          };
        })
      );
      return;
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!interaction) return;
    const { x, y } = getCanvasCoords(e);

    if (interaction.type === "drawRect") {
      const rect = normalizeRect({ x: interaction.startX, y: interaction.startY, w: x - interaction.startX, h: y - interaction.startY });
      setInteraction(null);
      if (rect.w < 4 || rect.h < 4) return;

      const pdf = canvasRectToPdfRect(rect);
      const id = generateId();
      if (mode === "whiteout") {
        const box: WhiteoutEdit = { id, type: "whiteout", pageIndex: currentPage, ...pdf };
        setEdits((prev) => [...prev, box]);
        setActiveEditId(id);
      } else if (mode === "addText") {
        const text: TextEdit = {
          id,
          type: "text",
          pageIndex: currentPage,
          ...pdf,
          text: "Type your text",
          font: "Helvetica",
          fontSize: clamp(pdf.height * 0.75, 8, 48),
          color: { r: 0, g: 0, b: 0 },
          background: true,
        };
        setEdits((prev) => [...prev, text]);
        setActiveEditId(id);
      }
      return;
    }

    setInteraction(null);
  }

  function removeActive() {
    if (!activeEditId) return;
    pushUndo(edits);
    setEdits((prev) => prev.filter((e) => e.id !== activeEditId));
    setActiveEditId(null);
  }

  function undo() {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(edits.map((e) => structuredClone(e)));
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
    setEdits(prev);
    setActiveEditId(null);
    setInteraction(null);
  }

  function redo() {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(edits.map((e) => structuredClone(e)));
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
    setEdits(next);
    setActiveEditId(null);
    setInteraction(null);
  }

  async function exportPdf() {
    if (!file) return;
    if (edits.length === 0) {
      toast.message("No edits yet.");
      return;
    }
    setIsExporting(true);
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);

      const fontCache = new Map<TextEdit["font"], PDFFont>();
      async function getFont(font: TextEdit["font"]): Promise<PDFFont> {
        const cached = fontCache.get(font);
        if (cached) return cached;
        const embedded =
          font === "TimesRoman"
            ? await pdfDoc.embedFont(StandardFonts.TimesRoman)
            : font === "Courier"
            ? await pdfDoc.embedFont(StandardFonts.Courier)
            : await pdfDoc.embedFont(StandardFonts.Helvetica);
        fontCache.set(font, embedded);
        return embedded;
      }

      const pages = pdfDoc.getPages();
      for (const ed of edits) {
        const page = pages[ed.pageIndex];
        if (!page) continue;

        if (ed.type === "whiteout") {
          page.drawRectangle({
            x: ed.x,
            y: ed.y,
            width: ed.width,
            height: ed.height,
            color: rgb(1, 1, 1),
            opacity: 1,
            borderOpacity: 0,
          });
          continue;
        }

        if (ed.type === "text") {
          if (ed.background) {
            page.drawRectangle({
              x: ed.x,
              y: ed.y,
              width: ed.width,
              height: ed.height,
              color: rgb(1, 1, 1),
              opacity: 1,
              borderOpacity: 0,
            });
          }

          const font = await getFont(ed.font);
          const maxWidth = Math.max(1, ed.width - 6);
          const lines = (() => {
            const tokens = ed.text.replace(/\\s+/g, " ").trim().split(" ").filter(Boolean);
            if (tokens.length === 0) return [""];
            const out: string[] = [];
            let cur = "";
            for (const token of tokens) {
              const attempt = cur ? `${cur} ${token}` : token;
              if (font.widthOfTextAtSize(attempt, ed.fontSize) <= maxWidth || !cur) {
                cur = attempt;
              } else {
                out.push(cur);
                cur = token;
              }
            }
            if (cur) out.push(cur);
            return out;
          })();
          const lineHeight = ed.fontSize * 1.15;
          let y = ed.y + ed.height - ed.fontSize - 2;
          for (const line of lines) {
            if (y < ed.y + 2) break;
            page.drawText(line, { x: ed.x + 3, y, size: ed.fontSize, font, color: rgb(ed.color.r, ed.color.g, ed.color.b) });
            y -= lineHeight;
          }
          continue;
        }

        if (ed.type === "stroke") {
          if (ed.points.length < 2) continue;
          for (let i = 1; i < ed.points.length; i++) {
            const a = ed.points[i - 1]!;
            const b = ed.points[i]!;
            page.drawLine({
              start: { x: a.x, y: a.y },
              end: { x: b.x, y: b.y },
              thickness: ed.thickness,
              color: rgb(ed.color.r, ed.color.g, ed.color.b),
              opacity: 1,
            });
          }
          continue;
        }
      }

      const out = await pdfDoc.save();
      downloadFile(out, `${fileBaseName(file.name)}-edited.pdf`);
      toast.success("Edited PDF downloaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export PDF.";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  }

  const activeText = activeRectEdit?.type === "text" ? activeRectEdit : null;

  function updateActiveText(next: Partial<TextEdit>) {
    if (!activeText) return;
    setEdits((prev) =>
      prev.map((e) => {
        if (e.id !== activeText.id || e.type !== "text") return e;
        return { ...e, ...next };
      })
    );
  }

  return (
    <ToolLayout
      title="Edit PDF"
      description="Sejda-style editing is hard to do 100% faithfully without a full PDF engine. This tool keeps everything local by applying edits as overlays (cover + redraw) and exporting a new PDF."
    >
      <div className="space-y-6">
        {!file ? (
          <DropZone onDrop={handleDrop} accept={PDF_ACCEPT} multiple={false} label="Drop a PDF here or click to browse" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
            {/* Sidebar */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">
                    {pageCount > 0 ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : "Loading…"}
                  </p>
                </div>
                <button
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  onClick={() => {
                    setFile(null);
                    setPageCount(0);
                    setEdits([]);
                    setActiveEditId(null);
                    setCurrentPage(0);
                    setMode("select");
                    setInteraction(null);
                    undoStackRef.current = [];
                    redoStackRef.current = [];
                    setUndoDepth(0);
                    setRedoDepth(0);
                    resetThumbs();
                  }}
                >
                  Remove
                </button>
              </div>

              <div className="space-y-2">
                <Label>Tool</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={mode === "select" ? "default" : "outline"}
                    onClick={() => setMode("select")}
                    disabled={isRendering}
                  >
                    <MousePointer2 className="w-4 h-4 mr-2" />
                    Select
                  </Button>
                  <Button
                    variant={mode === "editText" ? "default" : "outline"}
                    onClick={() => setMode("editText")}
                    disabled={isRendering}
                  >
                    <PencilLine className="w-4 h-4 mr-2" />
                    Edit text
                  </Button>
                  <Button
                    variant={mode === "addText" ? "default" : "outline"}
                    onClick={() => setMode("addText")}
                    disabled={isRendering}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Add text
                  </Button>
                  <Button
                    variant={mode === "whiteout" ? "default" : "outline"}
                    onClick={() => setMode("whiteout")}
                    disabled={isRendering}
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Whiteout
                  </Button>
                  <Button
                    variant={mode === "draw" ? "default" : "outline"}
                    onClick={() => setMode("draw")}
                    disabled={isRendering}
                  >
                    <Brush className="w-4 h-4 mr-2" />
                    Draw
                  </Button>
                  <Button variant="outline" onClick={removeActive} disabled={!activeEditId || isRendering}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  Tip: Use <span className="font-medium text-gray-600">Edit text</span> then click on existing text. It
                  is applied as a cover + redraw.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo || isRendering}>
                  <Undo2 className="w-4 h-4 mr-1" />
                  Undo
                </Button>
                <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo || isRendering}>
                  <Redo2 className="w-4 h-4 mr-1" />
                  Redo
                </Button>
              </div>

              {activeText ? (
                <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700">Selected text</p>
                  <div className="space-y-2">
                    <Label htmlFor="edit-text-value">Text</Label>
                    <Input
                      id="edit-text-value"
                      value={activeText.text}
                      onChange={(e) => updateActiveText({ text: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-text-font">Font</Label>
                      <select
                        id="edit-text-font"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={activeText.font}
                        onChange={(e) => updateActiveText({ font: e.target.value as TextEdit["font"] })}
                      >
                        <option value="Helvetica">Helvetica</option>
                        <option value="TimesRoman">Times</option>
                        <option value="Courier">Courier</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-text-size">Size</Label>
                      <Input
                        id="edit-text-size"
                        type="number"
                        min={6}
                        max={96}
                        value={activeText.fontSize}
                        onChange={(e) => updateActiveText({ fontSize: clamp(Number(e.target.value) || 12, 6, 96) })}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={activeText.background}
                      onChange={(e) => updateActiveText({ background: e.target.checked })}
                    />
                    Cover original text (white background)
                  </label>
                </div>
              ) : (
                <div className="text-xs text-gray-400">
                  Select a text box to edit its contents and style.
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Zoom</Label>
                  <span className="text-xs text-gray-400">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setZoom((z) => clamp(Number((z / 1.25).toFixed(3)), 0.25, 4))}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Slider value={[zoom]} min={0.5} max={2.5} step={0.05} onValueChange={(v) => setZoom(v[0] ?? 1)} />
                  <Button variant="outline" size="icon" onClick={() => setZoom((z) => clamp(Number((z * 1.25).toFixed(3)), 0.25, 4))}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button onClick={exportPdf} disabled={isExporting || isRendering} className="w-full">
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export edited PDF
                  </>
                )}
              </Button>

              <div className="space-y-2">
                <Label>Pages</Label>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage <= 0 || isRendering}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <p className="text-xs text-gray-500">
                    Page <span className="font-medium text-gray-800">{currentPage + 1}</span> / {pageCount || "—"}
                  </p>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((p) => Math.min(Math.max(0, pageCount - 1), p + 1))}
                    disabled={pageCount <= 0 || currentPage >= pageCount - 1 || isRendering}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="max-h-[320px] overflow-auto pr-1 space-y-2">
                  {thumbUrls.map((url, idx) => {
                    const isActive = idx === currentPage;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`w-full text-left border rounded-lg p-2 flex items-start gap-2 transition-colors ${
                          isActive ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                        }`}
                        onClick={() => setCurrentPage(idx)}
                        disabled={!url}
                      >
                        <div className="w-[64px] shrink-0">
                          {url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt={`Page ${idx + 1}`} className="w-full h-auto rounded border border-gray-200" />
                          ) : (
                            <div className="w-full aspect-[3/4] rounded bg-gray-100 border border-gray-200" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800">Page {idx + 1}</p>
                          <p className="text-[11px] text-gray-400">
                            {isRenderingThumbs && !url ? "Rendering…" : url ? "Ready" : "…"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {isRenderingThumbs ? (
                    <p className="text-[11px] text-gray-400">
                      Thumbnails: {thumbsRendered}/{pageCount}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Canvas area */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">
                  Mode: <span className="font-medium text-gray-800">{mode}</span>
                </p>
                <p className="text-xs text-gray-400">{isRendering ? "Rendering…" : " "}</p>
              </div>

              <div className="w-full overflow-auto">
                <div className="relative inline-block">
                  <canvas ref={canvasRef} className="block bg-white" />
                  <div
                    ref={textLayerRef}
                    className="absolute inset-0"
                    style={{
                      pointerEvents: mode === "editText" ? "auto" : "none",
                      opacity: mode === "editText" ? 1 : 0,
                    }}
                    onClick={onTextLayerClick}
                  />
                  <canvas
                    ref={overlayRef}
                    className="absolute inset-0"
                    style={{ cursor: mode === "select" ? "default" : "crosshair", pointerEvents: mode === "editText" ? "none" : "auto" }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-400">
                Notes: This editor currently supports overlay edits (whiteout, new text, and drawing). True in-place PDF
                content editing is not reliably possible with lightweight OSS libraries.
              </p>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
