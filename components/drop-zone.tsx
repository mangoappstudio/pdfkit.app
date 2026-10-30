"use client";

import { useCallback, useId, useState } from "react";
import { useDropzone, type DropzoneOptions } from "react-dropzone";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToolBusy } from "@/components/tool-workspace";

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
  const busy = useToolBusy();
  const unavailable = disabled || busy;
  const [error, setError] = useState("");
  const descriptionId = useId();
  const supportedTypes = accept ? Object.values(accept).flat().join(", ") : "";
  const onDropCallback = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) onDrop(acceptedFiles);
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive, isFocused, isDragReject } = useDropzone({
    onDrop: (files, rejections) => {
      const tooMany = rejections.some(({ errors }) => errors.some(({ code }) => code === "too-many-files"));
      setError(rejections.length === 0 ? "" : tooMany
        ? "Choose one file at a time for this tool."
        : `${rejections.length} file${rejections.length === 1 ? " was" : "s were"} not added. Choose a supported file type${supportedTypes ? ` (${supportedTypes})` : ""}.`);
      onDropCallback(files);
    },
    accept,
    multiple,
    disabled: unavailable,
  });

  return (
    <div className="space-y-2">
      <div
        {...getRootProps({ role: "button", "aria-label": label, "aria-describedby": descriptionId, "aria-disabled": unavailable })}
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
          isDragReject ? "border-red-400 bg-red-50" : isDragActive
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50",
          isFocused && "outline outline-2 outline-offset-2 outline-blue-500",
          unavailable && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <input {...getInputProps({ "aria-label": label })} />
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p id={descriptionId} className="text-xs text-gray-500 mt-1">
          {sublabel || (accept ? `Supported files: ${Object.values(accept).flat().join(", ")}` : "Choose files to get started")}
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
