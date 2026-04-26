"use client";

import { useState, useCallback } from "react";
import { Eraser, FileText } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { deepScrubPDF, getPDFPageCount } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

export function RemoveMetadataClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    try {
      const count = await getPDFPageCount(f);
      setPageCount(count);
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
      setPageCount(0);
    }
  }, []);

  const handleScrub = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const bytes = await deepScrubPDF(file);
      downloadFile(bytes, `${file.name.replace(/\.pdf$/i, "")}-sanitized.pdf`);
      toast.success("Metadata scrubbed and downloaded!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to scrub metadata.";
      toast.error(message.includes("password") ? "This PDF is password-protected and cannot be modified." : message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="Remove Metadata"
      description="Rebuild a PDF locally to remove document metadata before sharing."
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
              <p className="text-xs text-gray-400">{pageCount} pages</p>
            </div>
            <button
              className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0"
              onClick={() => {
                setFile(null);
                setPageCount(0);
              }}
              disabled={isProcessing}
            >
              Remove
            </button>
          </div>
        )}

        {file && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
            <p className="font-medium mb-1">Important</p>
            <p className="text-amber-800">
              This rebuilds the PDF by copying pages. It may remove bookmarks, forms, or other interactive features.
            </p>
          </div>
        )}

        {file && (
          <div className="flex justify-end">
            <Button onClick={handleScrub} disabled={isProcessing} className="gap-2">
              <Eraser className="w-4 h-4" />
              {isProcessing ? "Scrubbing…" : "Scrub metadata & download"}
            </Button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
