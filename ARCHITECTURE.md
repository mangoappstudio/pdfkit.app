# Architecture

PDFKit.app is a privacy-first set of PDF utilities where **all document
processing is intended to happen in the browser**.

## Tech stack

- Next.js App Router (Next.js 16)
- TypeScript
- Tailwind CSS + shadcn/ui
- `pdf-lib` for PDF manipulation
- `pdfjs-dist` (PDF.js) for rendering previews/thumbnails

## Repository structure

- `app/`: Next.js App Router routes
  - `app/page.tsx`: homepage / tool catalog
  - `app/<tool>/page.tsx`: Server Component (metadata + shell)
  - `app/<tool>/client.tsx`: Client Component (UI + browser-only logic)
- `components/`: shared UI building blocks (`ToolLayout`, `DropZone`, etc.)
- `lib/`: pure helpers and browser utilities (PDF operations, downloads)

## Tool pattern

Each tool follows a strict split:

- Server component: minimal, exports metadata and renders the client component.
- Client component: all interactive UI and browser APIs, uses `lib/` helpers,
  then downloads results via `lib/download.ts`.

## PDF.js worker

PDF rendering uses PDF.js via `pdfjs-dist`. The worker is copied during install:

- `postinstall`: copies `node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
  to `public/pdf.worker.min.mjs`
- client code should set `GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"`

This keeps rendering fully local while ensuring the worker is available at a
stable path.

## Privacy & security invariants

- No uploads, accounts, or server-side document processing.
- Avoid introducing network calls that include filenames, page text, or other
  document-derived data.
- Prefer pure functions in `lib/` so tools remain easy to audit.

