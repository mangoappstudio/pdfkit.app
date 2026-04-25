"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FileText, Loader2, Stamp } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { addWatermark, getPDFPageCount, parsePageRanges } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

export function AddWatermarkClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(45);
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#666666");
  const [pageRange, setPageRange] = useState("");
  const [position, setPosition] = useState<"center" | "top-left" | "top-right" | "bottom-left" | "bottom-right">("center");
  const [tiled, setTiled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const pageInfoRef = useRef<{ width: number; height: number; scale: number }>({ width: 0, height: 0, scale: 1 });

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPageRange("");
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
      setPageCount(0);
    }
  }, []);

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace("#", "").trim();
    const expanded = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const int = parseInt(expanded, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return { r: r / 255, g: g / 255, b: b / 255 };
  }

  useEffect(() => {
    if (!file || !canvasRef.current) return;

    const fileForPreview = file;
    let cancelled = false;
    setIsRenderingPreview(true);

    async function render() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await fileForPreview.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdfDoc.getPage(1);

        if (cancelled) return;

        const container = canvasRef.current!.parentElement!;
        const containerWidth = Math.min(container.clientWidth || 600, 720);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / viewport.width, 1.5);
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

        pageInfoRef.current = { width: viewport.width, height: viewport.height, scale };

        await page.render({ canvas, viewport: scaledViewport }).promise;
      } catch {
        if (!cancelled) toast.error("Failed to render preview.");
      } finally {
        if (!cancelled) setIsRenderingPreview(false);
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!text.trim()) return;

    const { scale } = pageInfoRef.current;
    const w = overlay.width;
    const h = overlay.height;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    ctx.font = `bold ${Math.max(10, Math.min(fontSize, 96)) * scale}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const measured = ctx.measureText(text);
    const textW = measured.width;
    const margin = 24 * scale;

    const anchor = () => {
      if (position === "top-left") return { x: margin, y: margin + fontSize * scale };
      if (position === "top-right") return { x: w - margin - textW, y: margin + fontSize * scale };
      if (position === "bottom-left") return { x: margin, y: h - margin };
      if (position === "bottom-right") return { x: w - margin - textW, y: h - margin };
      return { x: (w - textW) / 2, y: h / 2 };
    };

    const drawOne = (x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };

    if (!tiled) {
      const { x, y } = anchor();
      drawOne(x, y);
      ctx.restore();
      return;
    }

    const gap = Math.max(120, fontSize * 4) * scale;
    for (let x = -w; x <= w * 2; x += gap) {
      for (let y = -h; y <= h * 2; y += gap) {
        drawOne(x, y);
      }
    }
    ctx.restore();
  }, [text, opacity, rotation, fontSize, color, position, tiled]);

  const handleApply = async () => {
    if (!file || !text.trim()) return;
    setIsProcessing(true);
    try {
      const pageIndices = pageRange.trim() ? parsePageRanges(pageRange.trim(), pageCount) : undefined;
      const bytes = await addWatermark(file, {
        text: text.trim(),
        opacity,
        rotation,
        fontSize,
        color: hexToRgb(color),
        pageIndices,
        position,
        tiled,
      });
      downloadFile(bytes, `${file.name.replace(/\.pdf$/i, "")}-watermarked.pdf`);
      toast.success("Watermark applied and downloaded!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply watermark.";
      toast.error(message.includes("password") ? "This PDF is password-protected and cannot be modified." : message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="Add Watermark"
      description="Add a text watermark to every page of your PDF."
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
            </div>
            <button
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              onClick={() => {
                setFile(null);
                setPageCount(0);
                setPageRange("");
              }}
            >
              Remove
            </button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-800">Watermark settings</h2>

          <div className="space-y-2">
            <Label htmlFor="watermark-text">Watermark text</Label>
            <Input
              id="watermark-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. CONFIDENTIAL"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pages">
              Apply to pages{" "}
              <span className="text-gray-400 font-normal">
                (optional; e.g. <code className="bg-gray-100 px-1 rounded text-xs">1-3,8</code>)
              </span>
            </Label>
            <Input
              id="pages"
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              placeholder={pageCount ? `Leave blank for all ${pageCount} pages` : "Leave blank for all pages"}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Color</Label>
              <p className="text-xs text-gray-400">Used for PDF export and preview.</p>
            </div>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-14 h-10 p-1"
              aria-label="Watermark color"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Opacity</Label>
              <span className="text-sm text-gray-500">{Math.round(opacity * 100)}%</span>
            </div>
            <Slider
              min={0.05}
              max={1}
              step={0.05}
              value={[opacity]}
              onValueChange={([v]) => setOpacity(v)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Rotation</Label>
              <span className="text-sm text-gray-500">{rotation}°</span>
            </div>
            <Slider
              min={0}
              max={360}
              step={5}
              value={[rotation]}
              onValueChange={([v]) => setRotation(v)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Font size</Label>
              <span className="text-sm text-gray-500">{fontSize}pt</span>
            </div>
            <Slider
              min={12}
              max={120}
              step={4}
              value={[fontSize]}
              onValueChange={([v]) => setFontSize(v)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Placement</Label>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={tiled ? "default" : "outline"} onClick={() => setTiled(true)}>
                  Tiled
                </Button>
                <Button size="sm" variant={!tiled ? "default" : "outline"} onClick={() => setTiled(false)}>
                  Single
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: "top-left", label: "Top left" },
                  { key: "center", label: "Center" },
                  { key: "top-right", label: "Top right" },
                  { key: "bottom-left", label: "Bottom left" },
                  { key: "bottom-right", label: "Bottom right" },
                ] as const
              ).map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPosition(p.key)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    position === p.key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {file ? (
            <div className="bg-gray-100 rounded-xl overflow-auto p-4">
              <div className="relative inline-block select-none">
                {isRenderingPreview && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Rendering…
                    </span>
                  </div>
                )}
                <canvas ref={canvasRef} className="block shadow-sm rounded" />
                <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Preview shows page 1 with a visual overlay (export uses PDF drawing).
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 h-32 flex items-center justify-center overflow-hidden">
              <span
                style={{
                  opacity,
                  transform: `rotate(${rotation}deg)`,
                  fontSize: `${Math.min(fontSize, 36)}px`,
                  color,
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                }}
              >
                {text || "Watermark preview"}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleApply}
            disabled={!file || !text.trim() || isProcessing}
            className="gap-2"
          >
            <Stamp className="w-4 h-4" />
            {isProcessing ? "Applying…" : "Apply Watermark"}
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
}
