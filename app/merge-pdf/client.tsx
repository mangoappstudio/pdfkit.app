"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FileStack, Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { FileList } from "@/components/file-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mergePDFs } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { formatFileSize, generateId, PDF_ACCEPT } from "@/lib/file-utils";
import { getPDFPageCount } from "@/lib/pdf-utils";

interface PDFFileItem {
  id: string;
  file: File;
}

type PdfJsModule = typeof import("pdfjs-dist");

export function MergePDFClient() {
  const [files, setFiles] = useState<PDFFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputName, setOutputName] = useState("merged");
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [isRenderingPreviews, setIsRenderingPreviews] = useState(false);
  const prevIdsRef = useRef<Set<string>>(new Set());

  const handleDrop = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter((f) => f.type === "application/pdf");
    if (validFiles.length < newFiles.length) {
      toast.error("Some files were skipped — only PDF files are supported.");
    }
    setFiles((prev) => [
      ...prev,
      ...validFiles.map((file) => ({ id: generateId(), file })),
    ]);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleReorder = useCallback((ids: string[]) => {
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.id, f]));
      return ids.map((id) => map.get(id)!).filter(Boolean);
    });
  }, []);

  const ids = useMemo(() => new Set(files.map((f) => f.id)), [files]);

  useEffect(() => {
    async function run() {
      const prev = prevIdsRef.current;
      const removed: string[] = [];
      prev.forEach((id) => {
        if (!ids.has(id)) removed.push(id);
      });
      if (removed.length === 0) {
        prevIdsRef.current = ids;
        return;
      }
      setPageCounts((prevCounts) => {
        const next = { ...prevCounts };
        removed.forEach((id) => delete next[id]);
        return next;
      });
      setThumbs((prevThumbs) => {
        const next = { ...prevThumbs };
        removed.forEach((id) => {
          const url = next[id];
          if (url) URL.revokeObjectURL(url);
          delete next[id];
        });
        return next;
      });
      prevIdsRef.current = ids;
    }
    run();
  }, [ids]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (files.length === 0) {
        setPageCounts({});
        setThumbs((prev) => {
          Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
          return {};
        });
        prevIdsRef.current = new Set();
        return;
      }

      try {
        for (const f of files) {
          if (cancelled) return;
          if (pageCounts[f.id] === undefined) {
            try {
              const count = await getPDFPageCount(f.file);
              if (cancelled) return;
              setPageCounts((prev) => (prev[f.id] === undefined ? { ...prev, [f.id]: count } : prev));
            } catch {
              // ignore per-file failure
            }
          }
        }
      } finally {
        // nothing
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  useEffect(() => {
    if (files.length === 0) return;

    let cancelled = false;

    async function run() {
      setIsRenderingPreviews(true);
      try {
        const pdfjsLib = (await import("pdfjs-dist")) as PdfJsModule;
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        for (const f of files) {
          if (cancelled) return;
          if (thumbs[f.id]) continue;

          let pdfDoc: PDFDocumentProxy | null = null;
          try {
            const arrayBuffer = await f.file.arrayBuffer();
            pdfDoc = await (pdfjsLib.getDocument({ data: arrayBuffer }).promise as Promise<PDFDocumentProxy>);
            const page = await pdfDoc.getPage(1);
            const viewport = page.getViewport({ scale: 1 });
            const desiredWidth = 96;
            const scale = Math.min(desiredWidth / viewport.width, 1);
            const scaledViewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.ceil(scaledViewport.width));
            canvas.height = Math.max(1, Math.ceil(scaledViewport.height));
            await page.render({ canvas, viewport: scaledViewport }).promise;

            const blob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to generate preview."))), "image/png");
            });

            const url = URL.createObjectURL(blob);
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }
            setThumbs((prev) => (prev[f.id] ? prev : { ...prev, [f.id]: url }));
          } catch {
            // ignore per-file failure
          } finally {
            try {
              await pdfDoc?.destroy?.();
            } catch {
              // ignore
            }
          }
        }
      } finally {
        if (!cancelled) setIsRenderingPreviews(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const handleMerge = async () => {
    if (files.length < 2) return;
    setIsProcessing(true);
    try {
      const merged = await mergePDFs(files.map((f) => f.file));
      const name = `${(outputName.trim() || "merged").replace(/\\.pdf$/i, "")}.pdf`;
      downloadFile(merged, name);
      toast.success("PDFs merged and downloaded!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to merge PDFs.";
      toast.error(message.includes("password") ? "One or more PDFs are password-protected." : message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="Merge PDF"
      description="Combine multiple PDF files into one. Drag to reorder them before merging."
    >
      <div className="space-y-5">
        <DropZone
          onDrop={handleDrop}
          accept={PDF_ACCEPT}
          multiple
          label="Drop PDF files here or click to browse"
          sublabel="You can add multiple files at once"
        />

        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-gray-700">
                  {files.length} file{files.length !== 1 ? "s" : ""} selected
                </p>
                {isRenderingPreviews && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    Rendering previews…
                  </p>
                )}
              </div>
              <button
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                onClick={() => {
                  setFiles([]);
                  setOutputName("merged");
                  setPageCounts({});
                  setThumbs((prev) => {
                    Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
                    return {};
                  });
                }}
              >
                Clear all
              </button>
            </div>
            <FileList
              items={files}
              onRemove={handleRemove}
              onReorder={handleReorder}
              renderLeft={(item) => (
                <div className="w-12 h-14 rounded border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                  {thumbs[item.id] ? (
                    <img
                      src={thumbs[item.id]!}
                      alt={`${item.file.name} preview`}
                      className="w-full h-full object-contain bg-white"
                      draggable={false}
                    />
                  ) : (
                    <FileStack className="w-4 h-4 text-gray-300" aria-hidden="true" />
                  )}
                </div>
              )}
              getTitle={(item) => item.file.name}
              getMeta={(item) => {
                const pages = pageCounts[item.id];
                const pagesLabel = pages ? `${pages} page${pages !== 1 ? "s" : ""}` : "Counting pages…";
                return `${pagesLabel} · ${formatFileSize(item.file.size)}`;
              }}
            />
          </div>
        )}

        {files.length === 0 && (
          <div className="text-center py-4 text-sm text-gray-400">
            Add at least 2 PDF files to merge
          </div>
        )}

        {files.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
            <p className="text-sm font-semibold text-gray-800">Output filename</p>
            <div className="flex items-center gap-2">
              <Input value={outputName} onChange={(e) => setOutputName(e.target.value)} placeholder="merged" />
              <span className="text-sm text-gray-400 shrink-0">.pdf</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-400">
            {files.length < 2 ? `Need ${2 - files.length} more file${files.length === 1 ? "" : "s"}` : `Ready to merge ${files.length} files`}
          </p>
          <Button
            onClick={handleMerge}
            disabled={files.length < 2 || isProcessing}
            className="gap-2"
          >
            <FileStack className="w-4 h-4" />
            {isProcessing ? "Merging…" : "Merge PDFs"}
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
}
