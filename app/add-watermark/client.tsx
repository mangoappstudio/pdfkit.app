"use client";

import { useState, useCallback } from "react";
import { Stamp, FileText } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { addWatermark } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

export function AddWatermarkClient() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(45);
  const [fontSize, setFontSize] = useState(48);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDrop = useCallback((files: File[]) => {
    setFile(files[0] ?? null);
  }, []);

  const handleApply = async () => {
    if (!file || !text.trim()) return;
    setIsProcessing(true);
    try {
      const bytes = await addWatermark(file, { text: text.trim(), opacity, rotation, fontSize });
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
              onClick={() => setFile(null)}
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

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 h-32 flex items-center justify-center overflow-hidden">
            <span
              style={{
                opacity,
                transform: `rotate(-${rotation}deg)`,
                fontSize: `${Math.min(fontSize, 36)}px`,
                color: "#666",
                fontWeight: "bold",
                whiteSpace: "nowrap",
              }}
            >
              {text || "Watermark preview"}
            </span>
          </div>
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
