<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

Practical guidance for working in `pdfkit_app/` as an agent (dev workflow, repo map, and project-specific invariants).

## What this app is

PDFKit.app is a privacy-first set of PDF utilities. **All document processing is intended to happen in the browser** (no uploads, no accounts).

## Useful commands

- Install deps (preferred with lockfile): `npm ci`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Production build: `npm run build`
- Run production server: `npm run start`

Note: `postinstall` copies `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` → `public/pdf.worker.min.mjs`. If PDF previews/redaction rendering break with a missing worker, re-run `npm install`/`npm ci`.

## Repo map (where things live)

- `app/`: Next.js App Router routes.
  - `app/layout.tsx`: root layout + global metadata + `<Toaster />`.
  - `app/page.tsx`: homepage (also the “catalog” of tools shown to users).
  - `app/<tool>/page.tsx`: server component that exports `metadata` and renders the client component.
  - `app/<tool>/client.tsx`: client component (all UI + browser APIs).
- `components/`: shared UI building blocks (`ToolLayout`, `DropZone`, `FileList`, etc).
- `components/ui/`: shadcn/ui components (Radix + Tailwind).
- `lib/pdf-utils.ts`: PDF operations (pdf-lib) and redaction primitives.
- `lib/download.ts`: browser download helpers.
- `public/pdf.worker.min.mjs`: vendored PDF.js worker (generated/copied; don’t edit).

## Next.js 16 specifics (read local docs first)

Before changing routing/layout behavior, read:

- `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

Project conventions used here:

- App Router only (`app/`); no `pages/`.
- `page.tsx` files are Server Components by default; interactive code belongs in `"use client"` files (typically `client.tsx`).
- In this Next.js version, `params` / `searchParams` are commonly typed as `Promise<...>` in server `page.tsx` examples—match the local docs when adding dynamic routes.

## Privacy / security invariants (do not break)

This project’s core promise is “local-only processing”.

- Do not add API routes / Route Handlers to upload or process document contents.
- Keep PDF operations browser-safe (use `File`, `ArrayBuffer`, `Uint8Array`; no `fs`, no Node-only modules).
- Avoid adding telemetry/analytics that could capture file names, page text, or document-derived data.

## Adding a new tool (route) the “house style” way

1. Create `app/<tool>/page.tsx`:
   - Export `metadata`.
   - Render `<ToolClient />` from `./client`.
2. Create `app/<tool>/client.tsx`:
   - Start with `"use client";`
   - Compose `ToolLayout`, `DropZone`, and (when needed) `FileList`.
   - Call pure helpers from `lib/pdf-utils.ts`, then `downloadFile()` to export.
3. Add the tool card to the homepage lists in `app/page.tsx` (`primaryTools` / `supportingTools`) so users can discover it.
4. If the tool needs PDF rendering:
   - Use dynamic `await import("pdfjs-dist")` inside a Client Component effect.
   - Set `GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"` (expects `postinstall` to have copied the worker).

## Bundling / dependency gotchas

- `next.config.ts` disables the `canvas` alias in webpack. Keep this unless you intentionally change how PDF.js is bundled.
- `eslint.config.mjs` ignores `public/pdf.worker.min.mjs` because it’s vendored/copied output; keep it treated as generated.
