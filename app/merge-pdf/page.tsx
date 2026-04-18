import type { Metadata } from "next";
import { MergePDFClient } from "./client";

export const metadata: Metadata = {
  title: "Merge PDF",
  description: "Combine multiple PDF files into one. Reorder files before merging. Processed entirely in your browser.",
};

export default function MergePDFPage() {
  return <MergePDFClient />;
}
