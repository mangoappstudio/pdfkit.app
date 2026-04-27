import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { StructuredData } from "@/components/structured-data";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "About PDFKit.app — a private PDF preparation tool.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `About | ${SITE_NAME}`,
    url: `${SITE_URL}/about`,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
    },
  } as const;

  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <StructuredData data={structuredData} />

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
            PDFKit.app is a private document preparation tool for sensitive PDFs. It is built for people who need to prepare documents — redacting, extracting, reordering, watermarking, or assembling files — before sharing or uploading them anywhere.
          </p>

          <p>
            The core principle is simple: your files stay on your device. All supported tools process documents locally in your browser using standard web technologies. Nothing is uploaded. Nothing is stored. No account is needed.
          </p>

          <p>
            PDFKit.app is intentionally focused. Rather than being a generic PDF toolbox, it is organized around the task of preparing sensitive PDFs before they are shared — with bank institutions, employers, landlords, attorneys, or anyone else who needs to receive your documents.
          </p>

          <p>
            The tools available today cover the most important preparation tasks: redacting sensitive information, extracting only the pages you need, removing pages that should not be shared, adding watermarks, and merging documents into one clean packet. All of this happens locally in your browser.
          </p>

          <p>
            This is an early version. If you have feedback or ideas, we would love to hear them. The architecture is designed to be extensible — while the core tools will always remain local, optional cloud capabilities may be explored in the future with full transparency and explicit opt-in.
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
