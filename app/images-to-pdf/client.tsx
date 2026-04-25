"use client";

import { useState, useCallback } from "react";
import { ImagePlus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { FileList } from "@/components/file-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { imagesToPDF, type PageFitMode } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { formatFileSize, generateId, IMAGE_ACCEPT } from "@/lib/file-utils";

interface ImageItem {
  id: string;
  file: File;
  rotation: number;
}

const FIT_MODES: { value: PageFitMode; label: string; description: string }[] = [
  { value: "fit-to-image", label: "Fit to image", description: "Page size matches each image" },
  { value: "a4", label: "A4", description: "Standard international page size" },
  { value: "letter", label: "Letter", description: "US letter size (8.5 × 11 in)" },
];

export function ImagesToPDFClient() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [fitMode, setFitMode] = useState<PageFitMode>("fit-to-image");
  const [margin, setMargin] = useState(18);
  const [useBackground, setUseBackground] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [optimize, setOptimize] = useState(false);
  const [jpegQuality, setJpegQuality] = useState(0.85);
  const [outputName, setOutputName] = useState("images");
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const handleDrop = useCallback((files: File[]) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const valid = files.filter((f) => validTypes.includes(f.type.toLowerCase()));
    if (valid.length < files.length) {
      toast.error("Some files were skipped — only JPG, PNG, and WebP images are supported.");
    }
    const newItems = valid.map((file) => ({ id: generateId(), file, rotation: 0 }));
    setImages((prev) => [...prev, ...newItems]);
    setPreviewUrls((prev) => {
      const next = { ...prev };
      newItems.forEach((i) => {
        next[i.id] = URL.createObjectURL(i.file);
      });
      return next;
    });
  }, []);

  const handleRemove = useCallback((id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
    setPreviewUrls((prev) => {
      const next = { ...prev };
      const url = next[id];
      if (url) URL.revokeObjectURL(url);
      delete next[id];
      return next;
    });
  }, []);

  const handleReorder = useCallback((ids: string[]) => {
    setImages((prev) => {
      const map = new Map(prev.map((i) => [i.id, i]));
      return ids.map((id) => map.get(id)!).filter(Boolean);
    });
  }, []);

  const handleRotate = useCallback((id: string) => {
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, rotation: (i.rotation + 90) % 360 } : i)));
  }, []);

  function clearAll() {
    setImages([]);
    setPreviewUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return {};
    });
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace("#", "").trim();
    const expanded = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const int = parseInt(expanded, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return { r: r / 255, g: g / 255, b: b / 255 };
  }

  const handleConvert = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    try {
      const bytes = await imagesToPDF(images.map((i) => i.file), fitMode, {
        margin,
        backgroundColor: useBackground ? hexToRgb(backgroundColor) : undefined,
        jpegQuality: optimize ? jpegQuality : undefined,
        rotations: images.map((i) => i.rotation),
      });
      const name = `${(outputName.trim() || "images").replace(/\\.pdf$/i, "")}.pdf`;
      downloadFile(bytes, name);
      toast.success("PDF created and downloaded!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to convert images.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="Images to PDF"
      description="Upload images, reorder them, choose a page size, and export as a PDF."
    >
      <div className="space-y-5">
        <DropZone
          onDrop={handleDrop}
          accept={IMAGE_ACCEPT}
          multiple
          label="Drop images here or click to browse"
          sublabel="Supports JPG, PNG, WebP"
        />

        {images.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {images.length} image{images.length !== 1 ? "s" : ""}
              </p>
              <button
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                onClick={clearAll}
              >
                Clear all
              </button>
            </div>
            <FileList
              items={images}
              onRemove={handleRemove}
              onReorder={handleReorder}
              renderLeft={(item) => (
                <div className="w-12 h-14 rounded border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                  {previewUrls[item.id] ? (
                    <img
                      src={previewUrls[item.id]!}
                      alt={item.file.name}
                      className="w-full h-full object-contain bg-white"
                      style={{ transform: `rotate(${(item as ImageItem).rotation}deg)` }}
                      draggable={false}
                    />
                  ) : (
                    <ImagePlus className="w-4 h-4 text-gray-300" aria-hidden="true" />
                  )}
                </div>
              )}
              getTitle={(item) => item.file.name}
              getMeta={(item) => {
                const rot = (item as ImageItem).rotation;
                const rotLabel = rot ? ` · rotated ${rot}°` : "";
                return `${formatFileSize(item.file.size)}${rotLabel}`;
              }}
              renderActions={(item) => (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400 hover:text-blue-600"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRotate(item.id);
                  }}
                  aria-label="Rotate image"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </Button>
              )}
            />
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Page size</h2>
          <div className="grid grid-cols-3 gap-2">
            {FIT_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setFitMode(mode.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  fitMode === mode.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className={`text-sm font-medium ${fitMode === mode.value ? "text-blue-700" : "text-gray-700"}`}>
                  {mode.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{mode.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-800">Layout & optimization</h2>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Margins</Label>
              <span className="text-sm text-gray-500">{margin}pt</span>
            </div>
            <Slider min={0} max={72} step={2} value={[margin]} onValueChange={([v]) => setMargin(v)} />
            <p className="text-xs text-gray-400">
              Applies when using A4/Letter. Ignored for “Fit to image”.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Background</Label>
              <p className="text-xs text-gray-400">
                Useful for PNG/WebP transparency when exporting to PDF.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={useBackground ? "default" : "outline"}
                onClick={() => setUseBackground(true)}
              >
                On
              </Button>
              <Button
                size="sm"
                variant={!useBackground ? "default" : "outline"}
                onClick={() => setUseBackground(false)}
              >
                Off
              </Button>
              <Input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-12 h-10 p-1"
                disabled={!useBackground}
                aria-label="Background color"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Optimize file size</Label>
                <p className="text-xs text-gray-400">Re-encodes images as JPEG (local-only).</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={optimize ? "default" : "outline"} onClick={() => setOptimize(true)}>
                  On
                </Button>
                <Button size="sm" variant={!optimize ? "default" : "outline"} onClick={() => setOptimize(false)}>
                  Off
                </Button>
              </div>
            </div>
            {optimize && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">JPEG quality</span>
                  <span className="text-sm text-gray-500">{Math.round(jpegQuality * 100)}%</span>
                </div>
                <Slider
                  min={0.5}
                  max={0.95}
                  step={0.05}
                  value={[jpegQuality]}
                  onValueChange={([v]) => setJpegQuality(v)}
                />
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="output-name">Output filename</Label>
            <div className="flex items-center gap-2">
              <Input
                id="output-name"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="images"
              />
              <span className="text-sm text-gray-400 shrink-0">.pdf</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleConvert} disabled={images.length === 0 || isProcessing} className="gap-2">
            <ImagePlus className="w-4 h-4" />
            {isProcessing ? "Converting…" : "Convert to PDF"}
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
}
