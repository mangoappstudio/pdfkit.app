# Contributing

Thanks for contributing to PDFKit.app.

## Ground rules (privacy-first)

This app’s core promise is **local-only PDF processing**.

- Do not add APIs/Route Handlers that upload or process document contents.
- Keep PDF operations browser-safe (`File`, `ArrayBuffer`, `Uint8Array`).
- Avoid telemetry/analytics that could capture file names, page text, or other
  document-derived data.

## Development setup

```bash
yarn install --frozen-lockfile
yarn dev
```

Open http://localhost:3000.

## Quality checks

```bash
yarn lint
yarn build
```

## Adding a new tool

Follow the “house style” pattern:

1. Create `app/<tool>/page.tsx` (Server Component): export `metadata`, render
   the client component.
2. Create `app/<tool>/client.tsx` (Client Component): UI + browser APIs.
3. Add the tool card to `app/page.tsx` so users can discover it.
4. If the tool needs rendering, dynamically import `pdfjs-dist` in a Client
   Component and set the worker source to `/pdf.worker.min.mjs`.

## Pull requests

- Keep PRs focused and small.
- Include before/after screenshots for UI changes when possible.
- Call out any performance or memory implications (large PDFs can be expensive).

