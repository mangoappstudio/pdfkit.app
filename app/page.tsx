import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileStack,
  Scissors,
  ArrowUpDown,
  FileOutput,
  ImagePlus,
  Stamp,
  ShieldCheck,
  Cpu,
  UserX,
} from "lucide-react";

const tools = [
  {
    href: "/merge-pdf",
    icon: FileStack,
    title: "Merge PDF",
    description: "Combine multiple PDFs into one. Reorder files before merging.",
    color: "bg-blue-50 text-blue-600",
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
    description: "Drag and drop pages to reorder, rotate, or delete them.",
    color: "bg-green-50 text-green-600",
  },
  {
    href: "/extract-pages",
    icon: FileOutput,
    title: "Extract Pages",
    description: "Select specific pages and export them as a new PDF.",
    color: "bg-orange-50 text-orange-600",
  },
  {
    href: "/images-to-pdf",
    icon: ImagePlus,
    title: "Images to PDF",
    description: "Convert JPG, PNG, or WebP images into a single PDF.",
    color: "bg-pink-50 text-pink-600",
  },
  {
    href: "/add-watermark",
    icon: Stamp,
    title: "Add Watermark",
    description: "Add a customizable text watermark to every page.",
    color: "bg-amber-50 text-amber-600",
  },
];

const trustPoints = [
  {
    icon: ShieldCheck,
    title: "No file uploads",
    description: "Your files never leave your device for supported tools.",
  },
  {
    icon: UserX,
    title: "No account required",
    description: "Open a tool and start working immediately.",
  },
  {
    icon: Cpu,
    title: "Processed locally",
    description: "All PDF operations run entirely in your browser.",
  },
];

const useCases = [
  {
    title: "Visa document bundle",
    description: "Merge passport scans, bank statements, and invitation letters into a single organized PDF.",
  },
  {
    title: "Tax document prep",
    description: "Reorder and extract specific pages from tax forms before filing.",
  },
  {
    title: "Rental application",
    description: "Combine pay stubs, ID, and references into one clean packet.",
  },
  {
    title: "Secure PDF cleanup",
    description: "Remove pages or add a watermark to sensitive documents without uploading them.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-gray-900 text-lg">
            PDFKit<span className="text-blue-600">.app</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/merge-pdf" className="hover:text-gray-900 transition-colors">Tools</Link>
            <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <Badge variant="secondary" className="mb-6 text-xs font-medium">
          100% browser-based · No uploads · No accounts
        </Badge>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
          Private PDF tools that run<br className="hidden sm:block" /> in your browser
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Merge, split, reorder, and prepare sensitive PDFs without uploading them. Your documents stay on your device.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild>
            <Link href="#tools">Explore tools</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/merge-pdf">Start with Merge PDF</Link>
          </Button>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-gray-50 border-y border-gray-100 py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-8">
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
      </section>

      {/* Tool grid */}
      <section id="tools" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">PDF tools, built for sensitive documents</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Each tool runs entirely in your browser. No server processing, no storage, no tracking.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tools.map((tool) => {
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

      {/* Use cases */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Built for real-world document workflows</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {useCases.map((uc) => (
              <div key={uc.title} className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">{uc.title}</h3>
                <p className="text-gray-500 text-sm">{uc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
        <ShieldCheck className="w-10 h-10 text-blue-600 mx-auto mb-5" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your files stay on your device</h2>
        <p className="text-gray-500 max-w-xl mx-auto mb-6">
          For all tools in the current version, PDF processing happens entirely in your browser using standard web APIs.
          Files are not sent to our servers. No cloud storage is used. No document contents are logged.
        </p>
        <p className="text-gray-400 text-sm max-w-lg mx-auto">
          This is the core promise of PDFKit.app for its MVP tools. If cloud features are ever introduced in the future,
          they will be clearly opt-in and separate from these local tools.
        </p>
        <div className="mt-8">
          <Button variant="outline" asChild>
            <Link href="/privacy">Read our privacy approach</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-500">
            PDFKit<span className="text-blue-600">.app</span> · Privacy-first PDF tools
          </span>
          <nav className="flex items-center gap-5 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy</Link>
            <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>
            <Link href="/#tools" className="hover:text-gray-900 transition-colors">Tools</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
