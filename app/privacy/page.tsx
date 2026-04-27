import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { StructuredData } from "@/components/structured-data";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How PDFKit.app handles your files and data.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "PrivacyPolicy",
    name: `Privacy | ${SITE_NAME}`,
    url: `${SITE_URL}/privacy`,
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

        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Privacy</h1>
        </div>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Files are processed locally in your browser</h2>
            <p className="text-gray-600 leading-relaxed">
              All PDF tools in the current version of PDFKit.app process your files entirely within your browser.
              Your documents are not uploaded to our servers, not stored in cloud storage, and not sent to any
              third-party service. The PDF operations run using standard browser APIs and the pdf-lib JavaScript
              library, which execute locally on your device. Sensitive files stay on your device during processing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">No account required</h2>
            <p className="text-gray-600 leading-relaxed">
              PDFKit.app does not require you to create an account, log in, or provide any personal information.
              You can open any tool and start working immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">We do not upload document contents</h2>
            <p className="text-gray-600 leading-relaxed">
              For all tools currently available in PDFKit.app, document contents are never sent to a server.
              The files you load, the pages you extract, the redactions you apply, the watermarks you add —
              all of this happens locally and the results are downloaded directly to your device.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">What we may collect</h2>
            <p className="text-gray-600 leading-relaxed">
              Basic technical logs may exist for standard website operations (such as server access logs and
              error tracking). These logs do not contain the contents of your documents, file names, or
              any processed data. We do not use analytics that capture file content or sensitive metadata.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Future cloud features</h2>
            <p className="text-gray-600 leading-relaxed">
              If optional cloud-based features are introduced in the future, they will be clearly labeled,
              clearly opt-in, and entirely separate from the local tools described here. The local tools
              will always remain local.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Limitations</h2>
            <p className="text-gray-600 leading-relaxed">
              Because all processing happens in your browser, performance and memory limits depend on your device.
              Very large PDFs may be slow to process or may hit memory limits in older or low-memory browsers.
              We recommend using a modern browser (Chrome, Firefox, Safari, or Edge) for best results.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              Visual redaction (covering areas with black boxes) removes the visible content but does not
              rewrite the underlying PDF content stream. For documents requiring certified redaction,
              consult a professional tool designed for that purpose.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
