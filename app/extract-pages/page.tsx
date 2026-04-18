import type { Metadata } from "next";
import { ExtractPagesClient } from "./client";

export const metadata: Metadata = {
  title: "Extract Pages",
  description: "Select specific pages from a PDF and export them as a new file. All processing in your browser.",
};

export default function ExtractPagesPage() {
  return <ExtractPagesClient />;
}
