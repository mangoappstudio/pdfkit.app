"use client";

import { useState, useCallback } from "react";
import { FileStack } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { FileList } from "@/components/file-list";
import { Button } from "@/components/ui/button";
import { mergePDFs } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { generateId, PDF_ACCEPT } from "@/lib/file-utils";

interface PDFFileItem {
  id: string;
  file: File;
}

export function MergePDFClient() {
  const [files, setFiles] = useState<PDFFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleMerge = async () => {
    if (files.length < 2) return;
    setIsProcessing(true);
    try {
      const merged = await mergePDFs(files.map((f) => f.file));
      downloadFile(merged, "merged.pdf");
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
              <p className="text-sm font-medium text-gray-700">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </p>
              <button
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                onClick={() => setFiles([])}
              >
                Clear all
              </button>
            </div>
            <FileList items={files} onRemove={handleRemove} onReorder={handleReorder} />
          </div>
        )}

        {files.length === 0 && (
          <div className="text-center py-4 text-sm text-gray-400">
            Add at least 2 PDF files to merge
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
