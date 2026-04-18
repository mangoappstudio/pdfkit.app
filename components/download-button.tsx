"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadButtonProps {
  url: string;
  filename: string;
  label?: string;
}

export function DownloadButton({ url, filename, label = "Download" }: DownloadButtonProps) {
  return (
    <a href={url} download={filename}>
      <Button className="gap-2">
        <Download className="w-4 h-4" />
        {label}
      </Button>
    </a>
  );
}
