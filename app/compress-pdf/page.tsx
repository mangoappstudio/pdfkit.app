import type { Metadata } from "next";
import { CompressPdfClient } from "./client";

export const metadata: Metadata = {
  title: "Compress PDF",
  description: "Compress scanned PDFs locally in your browser by flattening pages into images.",
};

export default function CompressPdfPage() {
  return <CompressPdfClient />;
}

