import type { Metadata } from "next";
import { ImagesToPDFClient } from "./client";

export const metadata: Metadata = {
  title: "Images to PDF",
  description: "Convert JPG, PNG, and WebP images into a single PDF. All processing in your browser.",
};

export default function ImagesToPDFPage() {
  return <ImagesToPDFClient />;
}
