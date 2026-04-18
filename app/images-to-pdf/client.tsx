"use client";

import { useState, useCallback } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { FileList } from "@/components/file-list";
import { Button } from "@/components/ui/button";
import { imagesToPDF, type PageFitMode } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { generateId, IMAGE_ACCEPT } from "@/lib/file-utils";

interface ImageItem {
  id: string;
  file: File;
}

const FIT_MODES: { value: PageFitMode; label: string; description: string }[] = [
  { value: "fit-to-image", label: "Fit to image", description: "Page size matches each image" },
  { value: "a4", label: "A4", description: "Standard international page size" },
  { value: "letter", label: "Letter", description: "US letter size (8.5 × 11 in)" },
];

export function ImagesToPDFClient() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [fitMode, setFitMode] = useState<PageFitMode>("fit-to-image");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDrop = useCallback((files: File[]) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const valid = files.filter((f) => validTypes.includes(f.type.toLowerCase()));
    if (valid.length < files.length) {
      toast.error("Some files were skipped — only JPG, PNG, and WebP images are supported.");
    }
    setImages((prev) => [...prev, ...valid.map((file) => ({ id: generateId(), file }))]);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleReorder = useCallback((ids: string[]) => {
    setImages((prev) => {
      const map = new Map(prev.map((i) => [i.id, i]));
      return ids.map((id) => map.get(id)!).filter(Boolean);
    });
  }, []);

  const handleConvert = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    try {
      const bytes = await imagesToPDF(images.map((i) => i.file), fitMode);
      downloadFile(bytes, "images.pdf");
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
                onClick={() => setImages([])}
              >
                Clear all
              </button>
            </div>
            <FileList items={images} onRemove={handleRemove} onReorder={handleReorder} />
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
