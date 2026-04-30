"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getPDFPageCount, reorderPages } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

type RotationDegrees = 90 | 180 | 270;

function fileBaseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

export function RotatePDFClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [rotation, setRotation] = useState<RotationDegrees>(90);
  const [direction, setDirection] = useState<"clockwise" | "counterclockwise">("clockwise");
  const [isProcessing, setIsProcessing] = useState(false);

  const effectiveRotation = useMemo<RotationDegrees>(() => {
    if (direction === "clockwise") return rotation;
    return (360 - rotation) as RotationDegrees;
  }, [rotation, direction]);

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPageCount(0);
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
      setPageCount(0);
    }
  }, []);

  const canRotate = Boolean(file) && pageCount > 0 && !isProcessing;

  const handleRotate = useCallback(async () => {
    if (!file) return;
    if (pageCount <= 0) return;

    setIsProcessing(true);
    try {
      const pageOrder = Array.from({ length: pageCount }, (_, i) => i);
      const rotations: Record<number, number> = {};
      for (let i = 0; i < pageCount; i++) rotations[i] = effectiveRotation;

      const out = await reorderPages(file, pageOrder, rotations);
      downloadFile(out, `${fileBaseName(file.name)}-rotated.pdf`);
      toast.success("Rotated PDF downloaded!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to rotate this PDF.";
      toast.error(message.includes("password") ? "This PDF is password-protected and cannot be modified." : message);
    } finally {
      setIsProcessing(false);
    }
  }, [file, pageCount, effectiveRotation]);

  return (
    <ToolLayout
      title="Rotate PDF"
      description="Rotate every page in your PDF. For selective rotation, use Reorder Pages."
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
              <p className="text-xs text-gray-400">{pageCount ? `${pageCount} pages` : "Reading PDF…"}</p>
            </div>
            <button
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              onClick={() => {
                setFile(null);
                setPageCount(0);
              }}
            >
              Remove
            </button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-800">Rotation settings</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <select
                id="direction"
                className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                value={direction}
                onChange={(e) => setDirection(e.target.value as "clockwise" | "counterclockwise")}
              >
                <option value="clockwise">Clockwise</option>
                <option value="counterclockwise">Counter-clockwise</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rotation">Rotate by</Label>
              <select
                id="rotation"
                className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value, 10) as RotationDegrees)}
              >
                <option value={90}>90°</option>
                <option value={180}>180°</option>
                <option value={270}>270°</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            This rotates <span className="font-medium text-gray-600">all</span> pages. For selective rotation, use{" "}
            <span className="font-medium text-gray-600">Reorder Pages</span>.
          </p>
        </div>

        <div className="flex items-center justify-end">
          <Button onClick={handleRotate} disabled={!canRotate}>
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Rotating…
              </>
            ) : (
              "Rotate and download"
            )}
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
}

