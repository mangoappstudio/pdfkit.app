import type { Metadata } from "next";
import { PrepareClient } from "./client";

export const metadata: Metadata = {
  title: "Document Packet Builder",
  description: "Assemble, organize, and export a final PDF packet from multiple files. All processing in your browser.",
};

export default function PreparePage() {
  return <PrepareClient />;
}
