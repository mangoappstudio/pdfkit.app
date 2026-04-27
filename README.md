# PDFKit.app

A privacy-first PDF utility app that processes files entirely in your browser. No uploads. No accounts. No cloud processing.

## Open source

- License: MIT (`LICENSE`)
- Security: see `SECURITY.md`
- Contributing: see `CONTRIBUTING.md`
- Code of Conduct: see `CODE_OF_CONDUCT.md`
- Architecture notes: see `ARCHITECTURE.md`
- Third-party notices: see `THIRD_PARTY_NOTICES.md`

## Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** component library
- **pdf-lib** for PDF manipulation
- **PDF.js** for rendering (thumbnails/previews)
- **@dnd-kit** for drag-and-drop
- **react-dropzone** for file upload zones
- **Zod** + **React Hook Form** for validation
- **sonner** for toast notifications

## Local Dev

```bash
yarn install --frozen-lockfile
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

Note: `postinstall` copies `pdfjs-dist`’s worker to `public/pdf.worker.min.mjs`. If
PDF previews break due to a missing worker, re-run `yarn install`.

## Tools

| Tool | Route | Description |
|------|-------|-------------|
| Redact PDF | `/redact-pdf` | Cover sensitive areas with black boxes before sharing. |
| Merge PDF | `/merge-pdf` | Combine multiple PDFs. Drag to reorder. |
| Split PDF | `/split-pdf` | Split by page ranges or into individual pages. |
| Reorder Pages | `/reorder-pages` | Drag pages to reorder, rotate, or delete. |
| Extract Pages | `/extract-pages` | Select specific pages and export. |
| Remove Pages | `/remove-pages` | Select pages to remove and export the rest. |
| Images to PDF | `/images-to-pdf` | Convert JPG/PNG/WebP to PDF. |
| Add Watermark | `/add-watermark` | Add a text watermark to all pages. |
| Document Packet Builder | `/prepare` | Assemble multiple files into a single organized PDF packet. |
| PDF to Images | `/pdf-to-images` | Export selected pages as PNG/JPEG images (zipped). |
| Add Page Numbers | `/add-page-numbers` | Add simple page numbers to a PDF. |
| Remove Metadata | `/remove-metadata` | Deep scrub by rebuilding the PDF locally. |
| Compress PDF | `/compress-pdf` | Compress scanned PDFs (lossy, flattens pages). |

## Architecture

```
app/               # Next.js App Router pages
  page.tsx         # Homepage
  merge-pdf/       # Each tool has page.tsx (server, metadata) + client.tsx
  split-pdf/
  reorder-pages/
  extract-pages/
  images-to-pdf/
  add-watermark/
  privacy/
  about/
components/        # Shared UI components
  tool-layout.tsx  # Shared tool page shell
  drop-zone.tsx    # Dropzone upload component
  file-list.tsx    # Sortable file list
  download-button.tsx
  ui/              # shadcn/ui components
lib/               # Utility functions
  pdf-utils.ts     # All PDF operations (pdf-lib)
  download.ts      # Download helpers
  file-utils.ts    # File type constants, ID generation
  utils.ts         # cn() tailwind utility
```

## Privacy Model

**All PDF processing happens in the browser.** This is enforced architecturally:

1. There are no server API routes for document processing
2. `pdf-lib` runs entirely client-side
3. Files are read with the browser File API and never serialized to a server
4. No file contents are sent over the network
5. No analytics capture file names or document data

The privacy model is not just a promise — it is the only architecture that exists. There is no server-side processing to accidentally fall back to.

## Browser-only limitations

- Memory-bound: very large PDFs may slow down or fail on low-memory devices
- No OCR support
- Password-protected PDFs cannot be modified
- WebP image support depends on browser capability
- All processing is single-threaded in the main JS thread (Web Workers could offload this in future)

## Future extension ideas

These are intentionally not in the MVP:

- Web Worker offloading for large file operations
- Optional cloud processing with explicit opt-in
- PDF compression (lossy, scanned PDFs)
- OCR for scanned documents
- Batch processing

## License

MIT. See `LICENSE`.
