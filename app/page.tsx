import type { Metadata } from "next";
import Link from "next/link";
import { StructuredData } from "@/components/structured-data";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";
import { GITHUB_REPO_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import {
  EyeOff,
  FileOutput,
  MinusSquare,
  Stamp,
  FileStack,
  Package,
  Scissors,
  ArrowUpDown,
  ImagePlus,
  ImageDown,
  Hash,
  Eraser,
  Shrink,
  Lock,
  Unlock,
  RotateCw,
  FileCode2,
  ShieldCheck,
  Cpu,
  UserX,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      sameAs: [GITHUB_REPO_URL],
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
  ],
} as const;

const primaryTools = [
  {
    href: "/redact-pdf",
    icon: EyeOff,
    title: "Redact PDF",
    description: "Cover sensitive text and areas before sharing. Black out what should not be seen.",
    color: "bg-red-50 text-red-600",
  },
  {
    href: "/extract-pages",
    icon: FileOutput,
    title: "Extract Pages",
    description: "Select only the pages you need and export them as a new PDF.",
    color: "bg-orange-50 text-orange-600",
  },
  {
    href: "/remove-pages",
    icon: MinusSquare,
    title: "Remove Pages",
    description: "Remove pages you do not want to send before sharing the document.",
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    href: "/add-watermark",
    icon: Stamp,
    title: "Watermark PDF",
    description: "Add a watermark before sharing so the recipient knows the document's status.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    href: "/add-page-numbers",
    icon: Hash,
    title: "Add Page Numbers",
    description: "Add simple pagination before sharing, filing, or printing your document.",
    color: "bg-cyan-50 text-cyan-600",
  },
  {
    href: "/remove-metadata",
    icon: Eraser,
    title: "Remove Metadata",
    description: "Rebuild the PDF locally to scrub document metadata before sharing.",
    color: "bg-slate-50 text-slate-600",
  },
  {
    href: "/merge-pdf",
    icon: FileStack,
    title: "Merge PDF",
    description: "Combine supporting documents into one clean, shareable PDF.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    href: "/prepare",
    icon: Package,
    title: "Document Packet Builder",
    description: "Assemble, organize, and export a final PDF packet from multiple files.",
    color: "bg-indigo-50 text-indigo-600",
  },
];

const supportingTools = [
  {
    href: "/protect-pdf",
    icon: Lock,
    title: "Protect PDF",
    description: "Add password protection and optional permissions before sharing a document.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/unlock-pdf",
    icon: Unlock,
    title: "Unlock PDF",
    description: "Remove password protection when you know the password (user or owner).",
    color: "bg-lime-50 text-lime-600",
  },
  {
    href: "/split-pdf",
    icon: Scissors,
    title: "Split PDF",
    description: "Split by page ranges or extract every page as a separate file.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    href: "/reorder-pages",
    icon: ArrowUpDown,
    title: "Reorder Pages",
    description: "Drag and drop pages to reorder or rotate them.",
    color: "bg-green-50 text-green-600",
  },
  {
    href: "/rotate-pdf",
    icon: RotateCw,
    title: "Rotate PDF",
    description: "Rotate all pages 90°, 180°, or 270° in one click.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/images-to-pdf",
    icon: ImagePlus,
    title: "Images to PDF",
    description: "Convert JPG, PNG, or WebP images into a single PDF.",
    color: "bg-pink-50 text-pink-600",
  },
  {
    href: "/pdf-to-images",
    icon: ImageDown,
    title: "PDF to Images",
    description: "Export selected pages as PNG or JPEG images in a zip file.",
    color: "bg-rose-50 text-rose-600",
  },
  {
    href: "/html-to-pdf",
    icon: FileCode2,
    title: "HTML to PDF",
    description: "Convert HTML code (or an HTML file) into a downloadable PDF.",
    color: "bg-sky-50 text-sky-600",
  },
  {
    href: "/compress-pdf",
    icon: Shrink,
    title: "Compress PDF",
    description: "Best for scanned PDFs. Flatten pages to reduce file size before sharing.",
    color: "bg-teal-50 text-teal-600",
  },
];

const prepTasks = [
  "Remove pages you do not want to send",
  "Extract only the pages that are needed",
  "Redact sensitive information before uploading",
  "Add a watermark before sharing",
  "Merge supporting documents into one clean PDF",
];

const trustPoints = [
  {
    icon: ShieldCheck,
    title: "100% browser-based",
    description: "PDF operations run entirely in your browser using standard web APIs.",
  },
  {
    icon: UserX,
    title: "No uploads",
    description: "Your files never leave your device during processing.",
  },
  {
    icon: Cpu,
    title: "No account required",
    description: "Open any tool and start working immediately.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteNav />
      <StructuredData data={structuredData} />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 mb-8 text-xs text-gray-600 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
          100% browser-based · No uploads · No account required
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
          Prepare sensitive PDFs privately,<br className="hidden sm:block" /> right in your browser
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Redact, extract, reorder, watermark, and package documents locally before sharing or uploading them anywhere.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild>
            <Link href="/prepare">Start preparing documents</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#tools">See tools</Link>
          </Button>
        </div>
      </section>

      {/* Prepare before sharing */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Prepare documents before sharing</h2>
            <p className="text-gray-500 mb-6">
              Before you upload or share sensitive files, make sure they contain only what you intend to send.
            </p>
            <ul className="space-y-3">
              {prepTasks.map((task) => (
                <li key={task} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-700">{task}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm font-medium text-gray-900 mb-1">Sharing a bank statement?</p>
              <p className="text-sm text-gray-500">Redact your account number, then extract only the pages needed.</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm font-medium text-gray-900 mb-1">Sending a contract?</p>
              <p className="text-sm text-gray-500">Add a DRAFT watermark and remove any internal pages before sharing.</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm font-medium text-gray-900 mb-1">Submitting supporting documents?</p>
              <p className="text-sm text-gray-500">Merge everything into one clean PDF packet, organized exactly how you want it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Primary tools */}
      <section id="tools" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Tools for sensitive document prep</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Each tool runs entirely in your browser. Files stay on your device during processing.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {primaryTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group rounded-xl border border-gray-200 p-6 hover:border-blue-200 hover:shadow-sm transition-all bg-white"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${tool.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-sm text-gray-500">{tool.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Packet builder callout */}
      <section className="bg-indigo-50 border-y border-indigo-100 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Package className="w-10 h-10 text-indigo-600 mx-auto mb-5" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Document Packet Builder</h2>
          <p className="text-gray-600 max-w-xl mx-auto mb-6">
            Add multiple files, organize them in the right order, add an optional watermark or cover title, then export one final clean PDF — all locally in your browser.
          </p>
          <Button asChild>
            <Link href="/prepare">Build a document packet</Link>
          </Button>
        </div>
      </section>

      {/* Supporting tools */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Supporting tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {supportingTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group rounded-xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all bg-white"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tool.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm group-hover:text-blue-600 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-xs text-gray-500">{tool.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-gray-50 border-y border-gray-100 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-8">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {trustPoints.map((point) => {
              const Icon = point.icon;
              return (
                <div key={point.title} className="flex flex-col items-center text-center gap-2">
                  <Icon className="w-6 h-6 text-blue-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">{point.title}</h3>
                  <p className="text-gray-500 text-sm">{point.description}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400 max-w-lg mx-auto">
              Sensitive files stay on your device during processing. No document contents are sent to a server for any of the current tools. No cloud storage. No tracking.
            </p>
            <Link href="/privacy" className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800 transition-colors">
              Read how privacy works →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-500">
            PDFKit<span className="text-blue-600">.app</span> · Prepare sensitive PDFs before sharing
          </span>
          <nav className="flex items-center gap-5 text-sm text-gray-500">
            <Link href="/prepare" className="hover:text-gray-900 transition-colors">Prepare</Link>
            <Link href="/#tools" className="hover:text-gray-900 transition-colors">Tools</Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy</Link>
            <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>
            <a
              href="https://github.com/mangoappstudio/pdfkit.app"
              target="_blank"
              rel="noreferrer"
              className="hover:text-gray-900 transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
