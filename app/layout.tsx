import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "PDFKit.app – Prepare Sensitive PDFs Privately",
    template: "%s | PDFKit.app",
  },
  description:
    "Redact, extract, remove pages, watermark, and merge sensitive PDFs locally in your browser before sharing or uploading them anywhere.",
  keywords: ["PDF", "redact PDF", "extract pages", "remove pages", "watermark PDF", "merge PDF", "split PDF", "local processing", "private"],
  openGraph: {
    title: "PDFKit.app – Prepare Sensitive PDFs Privately",
    description: "Prepare sensitive PDFs before sharing. All processing happens locally in your browser. No uploads, no accounts.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
