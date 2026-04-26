"use client";

import { useMemo, useState, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { FileScan, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { downloadFile } from "@/lib/download";
import { getPDFPageCount } from "@/lib/pdf-utils";
import { PDF_ACCEPT } from "@/lib/file-utils";

type PdfJsModule = typeof import("pdfjs-dist");

type PresetKey = "small" | "balanced" | "high";

const PRESETS: Record<PresetKey, { label: string; scale: number; quality: number; helper: string }> = {
  small: { label: "Small", scale: 1.5, quality: 0.7, helper: "Small file size (more compression)" },
  balanced: { label: "Balanced", scale: 2, quality: 0.85, helper: "Good balance of size and clarity" },
  high: { label: "High quality", scale: 3, quality: 0.9, helper: "Larger file, sharper text/images" },
};

export function CompressPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [preset, setPreset] = useState<PresetKey>("balanced");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedPages, setProcessedPages] = useState(0);

  const presetInfo = PRESETS[preset];

  const progressValue = useMemo(() => {
    if (!isProcessing || pageCount <= 0) return 0;
    return Math.round((processedPages / pageCount) * 100);
  }, [isProcessing, processedPages, pageCount]);

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setProcessedPages(0);
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
      setPageCount(0);
    }
  }, []);

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProcessedPages(0);

    let pdfDoc: PDFDocumentProxy | null = null;
    try {
      const pdfjsLib = (await import("pdfjs-dist")) as PdfJsModule;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const arrayBuffer = await file.arrayBuffer();
      pdfDoc = await (pdfjsLib.getDocument({ data: arrayBuffer }).promise as Promise<PDFDocumentProxy>);

      const out = await PDFDocument.create();

      const totalPages = pdfDoc.numPages ?? pageCount;
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        const page = await pdfDoc.getPage(pageIndex + 1);

        const viewportBase = page.getViewport({ scale: 1 });
        const viewportRender = page.getViewport({ scale: presetInfo.scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(viewportRender.width));
        canvas.height = Math.max(1, Math.ceil(viewportRender.height));

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvas, viewport: viewportRender }).promise;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Failed to encode JPEG."))),
            "image/jpeg",
            Math.max(0.01, Math.min(presetInfo.quality, 1))
          );
        });

        const jpgBytes = await blob.arrayBuffer();
        const embedded = await out.embedJpg(jpgBytes);

        const outPage = out.addPage([viewportBase.width, viewportBase.height]);
        outPage.drawImage(embedded, {
          x: 0,
          y: 0,
          width: viewportBase.width,
          height: viewportBase.height,
        });

        setProcessedPages(pageIndex + 1);
        await new Promise((r) => setTimeout(r, 0));
      }

      const bytes = await out.save();
      downloadFile(bytes, `${file.name.replace(/\.pdf$/i, "")}-compressed.pdf`);
      toast.success("Compressed PDF downloaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to compress PDF.";
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
      title="Compress PDF"
      description="Best for scanned PDFs. Output is image-based — text won’t be selectable or searchable."
    >
      <div className="space-y-6">
        {!file ? (
          <DropZone
            onDrop={handleDrop}
            accept={PDF_ACCEPT}
            multiple={false}
            label="Drop a PDF file here or click to browse"
            sublabel="Best for scanned PDFs (image-heavy)"
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
                setFile(null);
                setPageCount(0);
                setProcessedPages(0);
              }}
              disabled={isProcessing}
            >
              Remove
            </button>
          </div>
        )}

        {file && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Compression preset</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(PRESETS).map(([key, info]) => {
                const k = key as PresetKey;
                const selected = k === preset;
                return (
                  <button
                    key={k}
                    onClick={() => setPreset(k)}
                    disabled={isProcessing}
                    className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold ${selected ? "text-blue-700" : "text-gray-800"}`}>
                        {info.label}{k === "balanced" ? " (default)" : ""}
                      </p>
                      <span className="text-xs text-gray-400 tabular-nums">
                        {info.scale}x · {info.quality.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{info.helper}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400">
              This tool flattens each page into a JPEG image. It can dramatically reduce size for scanned PDFs, but removes selectable text.
            </p>
          </div>
        )}

        {isProcessing && pageCount > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Compressing… {processedPages}/{pageCount}
              </span>
              <span className="tabular-nums">{progressValue}%</span>
            </div>
            <Progress value={progressValue} />
          </div>
        )}

        {file && (
          <div className="flex justify-end">
            <Button onClick={handleCompress} disabled={isProcessing} className="gap-2">
              <FileScan className="w-4 h-4" />
              {isProcessing ? "Compressing…" : `Compress & download (${PRESETS[preset].label})`}
            </Button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}

