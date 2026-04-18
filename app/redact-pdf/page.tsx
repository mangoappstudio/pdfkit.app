import type { Metadata } from "next";
import { RedactPDFClient } from "./client";

export const metadata: Metadata = {
  title: "Redact PDF",
  description: "Draw over sensitive information to redact it before sharing. All processing in your browser.",
};

export default function RedactPDFPage() {
  return <RedactPDFClient />;
}
