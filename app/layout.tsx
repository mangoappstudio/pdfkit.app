import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "PDFKit.app – Private PDF Tools",
    template: "%s | PDFKit.app",
  },
  description:
    "Merge, split, reorder, and prepare sensitive PDFs without uploading them. All processing happens locally in your browser.",
  keywords: ["PDF", "merge PDF", "split PDF", "reorder PDF", "privacy", "local processing"],
  openGraph: {
    title: "PDFKit.app – Private PDF Tools",
    description: "Privacy-first PDF tools that run entirely in your browser. No uploads, no accounts.",
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
