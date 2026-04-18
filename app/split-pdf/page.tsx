import type { Metadata } from "next";
import { SplitPDFClient } from "./client";

export const metadata: Metadata = {
  title: "Split PDF",
  description: "Split a PDF by page ranges or extract every page as a separate file. All processing in your browser.",
};

export default function SplitPDFPage() {
  return <SplitPDFClient />;
}
