import Link from "next/link";

export function SiteNav() {
  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-gray-900 text-lg">
          PDFKit<span className="text-blue-600">.app</span>
        </Link>
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
        </nav>
      </div>
    </header>
  );
}
