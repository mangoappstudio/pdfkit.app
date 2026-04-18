import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description: "About PDFKit.app — a privacy-first PDF utility.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center">
          <Link href="/" className="font-semibold text-gray-900 text-lg">
            PDFKit<span className="text-blue-600">.app</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">About PDFKit.app</h1>

        <div className="space-y-6 text-gray-600 leading-relaxed">
          <p>
            PDFKit.app is a privacy-first PDF utility app designed for sensitive document workflows.
            It was built for people who need to handle visa files, tax documents, rental applications,
            legal paperwork, and other sensitive PDFs — without uploading them to unknown servers.
          </p>

          <p>
            The core principle is simple: your files stay on your device. All supported tools process
            documents locally in your browser using standard web technologies. Nothing is uploaded.
            Nothing is stored. No account is needed.
          </p>

          <p>
            PDFKit.app is intentionally minimal. We build focused tools that do one thing well, rather than
            a bloated platform with features you don&apos;t need. The tools available today cover the most common
            PDF tasks: merging, splitting, reordering, extracting pages, converting images, and adding watermarks.
          </p>

          <p>
            This is an MVP. If you have feedback or ideas, we&apos;d love to hear them. The architecture is designed
            to be extensible — while the core tools will always remain local, optional cloud capabilities may
            be explored in the future, with full transparency and opt-in consent.
          </p>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100">
          <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            ← Back to tools
          </Link>
        </div>
      </main>
    </div>
  );
}
