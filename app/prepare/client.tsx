"use client";

import { useState, useCallback } from "react";
import { Package, FileText } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { FileList } from "@/components/file-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  mergePDFs,
  addCoverPage,
  addWatermark,
  addPageNumbers,
  getPDFPageCount,
  imagesToPDF,
  type AddPageNumbersFormat,
  type AddPageNumbersPosition,
} from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { generateId } from "@/lib/file-utils";

interface PacketFile {
  id: string;
  file: File;
}

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

async function fileToMergeable(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  // Convert image to PDF first
  const bytes = await imagesToPDF([file]);
  return new File([bytes.buffer as ArrayBuffer], file.name.replace(/\.[^.]+$/, ".pdf"), {
    type: "application/pdf",
  });
}

export function PrepareClient() {
  const [files, setFiles] = useState<PacketFile[]>([]);
  const [exportName, setExportName] = useState("document-packet");
  const [watermarkText, setWatermarkText] = useState("");
  const [includeCover, setIncludeCover] = useState(false);
  const [coverTitle, setCoverTitle] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [addPageNumbersEnabled, setAddPageNumbersEnabled] = useState(false);
  const [pageNumberFormat, setPageNumberFormat] = useState<AddPageNumbersFormat>("current-over-total");
  const [pageNumberPosition, setPageNumberPosition] = useState<AddPageNumbersPosition>("bottom-center");
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleDrop = useCallback((newFiles: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...newFiles.map((file) => ({ id: generateId(), file })),
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

  function bytesToPdfFile(bytes: Uint8Array, filename = "packet.pdf"): File {
    // Ensure we hand a plain ArrayBuffer (not ArrayBufferLike) to the File constructor.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const ab = copy.buffer as ArrayBuffer;
    return new File([ab], filename, { type: "application/pdf" });
  }

  const handleExport = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    try {
      // Convert any images to PDF, then merge
      const mergeableFiles = await Promise.all(files.map((f) => fileToMergeable(f.file)));

      let bytes = await mergePDFs(mergeableFiles);

      // Optional cover page (inserted at page 1)
      if (includeCover) {
        const title = (coverTitle.trim() || exportName.trim() || "Document Packet").replace(/\.pdf$/i, "");
        const note = coverNote.trim() || undefined;
        bytes = await addCoverPage(bytesToPdfFile(bytes), { title, note });
      }

      // Apply watermark if provided
      if (watermarkText.trim()) {
        bytes = await addWatermark(bytesToPdfFile(bytes), {
          text: watermarkText.trim(),
          opacity: 0.25,
          rotation: 45,
          fontSize: 48,
        });
      }

      // Optional page numbers (applied last, above watermark)
      if (addPageNumbersEnabled) {
        const pdfFile = bytesToPdfFile(bytes);
        const count = await getPDFPageCount(pdfFile);
        const pageIndices =
          includeCover && count > 1 ? Array.from({ length: count - 1 }, (_, i) => i + 1) : undefined;
        bytes = await addPageNumbers(pdfFile, {
          pageIndices,
          format: pageNumberFormat,
          position: pageNumberPosition,
          fontSize: 11,
          margin: 24,
          color: { r: 0.2, g: 0.2, b: 0.2 },
          startNumber: 1,
        });
      }

      const filename = `${(exportName.trim() || "document-packet").replace(/\.pdf$/i, "")}.pdf`;
      downloadFile(bytes, filename);
      toast.success("Document packet exported and downloaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to build packet.";
      toast.error(message.includes("password") ? "One or more files are password-protected." : message);
    } finally {
      setIsProcessing(false);
    }
  };

  const steps = [
    { num: 1 as const, label: "Add files" },
    { num: 2 as const, label: "Organize" },
    { num: 3 as const, label: "Export options" },
  ];

  return (
    <ToolLayout
      title="Document Packet Builder"
      description="Add, organize, and export multiple files as one clean PDF packet — locally in your browser."
    >
      <div className="space-y-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {steps.map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (s.num <= step || (s.num === 2 && files.length > 0)) {
                    setStep(s.num);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  step === s.num
                    ? "bg-blue-600 text-white"
                    : step > s.num
                    ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                    : "bg-gray-100 text-gray-400 cursor-default"
                }`}
              >
                <span className="text-xs font-bold">{s.num}</span>
                {s.label}
              </button>
              {idx < steps.length - 1 && (
                <div className={`h-px w-6 ${step > s.num ? "bg-blue-300" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Add files */}
        {step === 1 && (
          <div className="space-y-5">
            <DropZone
              onDrop={handleDrop}
              accept={ACCEPT}
              multiple
              label="Drop PDF or image files here"
              sublabel="Supports PDF, JPG, PNG, WebP · Images will be converted automatically"
            />

            {files.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    {files.length} file{files.length !== 1 ? "s" : ""} added
                  </p>
                  <button
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    onClick={() => setFiles([])}
                  >
                    Clear all
                  </button>
                </div>
                <FileList items={files} onRemove={handleRemove} onReorder={handleReorder} icon={<FileText className="w-4 h-4" />} />
              </div>
            )}

            {files.length === 0 && (
              <p className="text-sm text-gray-400 text-center">Add at least one file to begin.</p>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={files.length === 0}
              >
                Next: Organize →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Organize */}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              Drag to reorder files. Remove any you no longer want to include. Then add more files if needed.
            </p>

            <DropZone
              onDrop={handleDrop}
              accept={ACCEPT}
              multiple
              label="Add more files"
              className="py-5"
            />

            {files.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    {files.length} file{files.length !== 1 ? "s" : ""} in packet
                  </p>
                  <button
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    onClick={() => setFiles([])}
                  >
                    Clear all
                  </button>
                </div>
                <FileList items={files} onRemove={handleRemove} onReorder={handleReorder} icon={<FileText className="w-4 h-4" />} />
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={files.length === 0}>
                Next: Export options →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Export options */}
        {step === 3 && (
          <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
                <h2 className="text-sm font-semibold text-gray-800">Export options</h2>

                <div className="space-y-2">
                  <Label htmlFor="export-name">Output filename</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="export-name"
                      value={exportName}
                      onChange={(e) => setExportName(e.target.value)}
                      placeholder="document-packet"
                      className="flex-1"
                      disabled={isProcessing}
                    />
                    <span className="text-sm text-gray-400 shrink-0">.pdf</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="watermark-text">
                    Watermark text{" "}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="watermark-text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="e.g. CONFIDENTIAL or DRAFT"
                    maxLength={80}
                    disabled={isProcessing}
                  />
                  {watermarkText && (
                    <p className="text-xs text-gray-400">
                      Watermark will be applied to all pages at 25% opacity.
                      {includeCover ? " Watermark applies to the cover page too." : ""}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Cover page</Label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      checked={includeCover}
                      disabled={isProcessing}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setIncludeCover(next);
                        if (next && !coverTitle.trim()) {
                          setCoverTitle((exportName.trim() || "Document Packet").replace(/\.pdf$/i, ""));
                        }
                      }}
                    />
                    Include cover page <span className="text-gray-400">(optional)</span>
                  </label>
                  {includeCover && (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="cover-title">Cover title</Label>
                        <Input
                          id="cover-title"
                          value={coverTitle}
                          onChange={(e) => setCoverTitle(e.target.value)}
                          placeholder="e.g. Documents for Review"
                          maxLength={120}
                          disabled={isProcessing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cover-note">
                          Cover note <span className="text-gray-400 font-normal">(optional)</span>
                        </Label>
                        <textarea
                          id="cover-note"
                          value={coverNote}
                          onChange={(e) => setCoverNote(e.target.value)}
                          placeholder="Add an optional note for the recipient…"
                          className="w-full min-h-[96px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                          maxLength={1200}
                          disabled={isProcessing}
                        />
                        <p className="text-xs text-gray-400">Long notes will be truncated to fit on one cover page.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Page numbers</Label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      checked={addPageNumbersEnabled}
                      disabled={isProcessing}
                      onChange={(e) => setAddPageNumbersEnabled(e.target.checked)}
                    />
                    Add page numbers <span className="text-gray-400">(optional)</span>
                  </label>
                  {addPageNumbersEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="page-number-format">Format</Label>
                        <select
                          id="page-number-format"
                          value={pageNumberFormat}
                          onChange={(e) => setPageNumberFormat(e.target.value as AddPageNumbersFormat)}
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                          disabled={isProcessing}
                        >
                          <option value="current-over-total">1 / 10 (default)</option>
                          <option value="current">1</option>
                          <option value="page-current">Page 1</option>
                          <option value="page-current-of-total">Page 1 of 10</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="page-number-position">Position</Label>
                        <select
                          id="page-number-position"
                          value={pageNumberPosition}
                          onChange={(e) => setPageNumberPosition(e.target.value as AddPageNumbersPosition)}
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                          disabled={isProcessing}
                        >
                          <option value="bottom-center">Bottom center (default)</option>
                          <option value="bottom-left">Bottom left</option>
                          <option value="bottom-right">Bottom right</option>
                          <option value="top-left">Top left</option>
                          <option value="top-right">Top right</option>
                        </select>
                      </div>
                      {includeCover && (
                        <p className="text-xs text-gray-400 sm:col-span-2">
                          With a cover page enabled, numbering starts after the cover and begins at 1.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

            {/* Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Packet summary</h3>
              <ul className="space-y-1">
                {files.map((f, idx) => (
                  <li key={f.id} className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="text-gray-400 text-xs w-5 text-right shrink-0">{idx + 1}.</span>
                    <span className="truncate">{f.file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {(f.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </li>
                ))}
              </ul>
              {watermarkText && (
                <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                  Watermark: &ldquo;{watermarkText}&rdquo;
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button
                onClick={handleExport}
                disabled={files.length === 0 || isProcessing}
                className="gap-2"
              >
                <Package className="w-4 h-4" />
                {isProcessing ? "Building packet…" : "Export packet"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
