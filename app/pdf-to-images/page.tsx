import type { Metadata } from "next";
import { PdfToImagesClient } from "./client";

export const metadata: Metadata = {
  title: "PDF to Images",
  description: "Export selected PDF pages as PNG or JPEG images. All processing in your browser.",
};

export default function PdfToImagesPage() {
  return <PdfToImagesClient />;
}

