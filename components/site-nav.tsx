import Link from "next/link";
import { Github } from "lucide-react";

const githubRepoUrl = "https://github.com/mangoappstudio/pdfkit.app";

export function SiteNav() {
  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-gray-900 text-lg">
          PDFKit<span className="text-blue-600">.app</span>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/prepare" className="hover:text-gray-900 transition-colors">
              Prepare
            </Link>
            <Link href="/#tools" className="hover:text-gray-900 transition-colors">
              Tools
            </Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">
              Privacy
            </Link>
            <Link href="/about" className="hover:text-gray-900 transition-colors">
              About
            </Link>
            <a
              href={githubRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-gray-900 transition-colors"
            >
              GitHub
            </a>
          </nav>

          <a
            href={githubRepoUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
            className="inline-flex items-center justify-center rounded-md text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
        </div>
      </div>
    </header>
  );
}
