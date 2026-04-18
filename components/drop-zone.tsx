"use client";

import { useCallback } from "react";
import { useDropzone, type DropzoneOptions } from "react-dropzone";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onDrop: (files: File[]) => void;
  accept?: DropzoneOptions["accept"];
  multiple?: boolean;
  label?: string;
  sublabel?: string;
  className?: string;
  disabled?: boolean;
}

export function DropZone({
  onDrop,
  accept,
  multiple = true,
  label = "Drop files here or click to browse",
  sublabel,
  className,
  disabled,
}: DropZoneProps) {
  const onDropCallback = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) onDrop(acceptedFiles);
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropCallback,
    accept,
    multiple,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-blue-400 bg-blue-50"
          : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input {...getInputProps()} />
      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
    </div>
  );
}
