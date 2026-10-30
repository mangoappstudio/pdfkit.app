# PDFKit.app usability audit (#26)

Audit date: 2026-10-30. Covers all 18 tools using synthetic documents only. The production Node build is used for the complete interaction suite; the Cloudflare static export is also built and checked. Processing stays in the browser; no document API, account, analytics, or dependency upgrade was added.

## Findings and changes

| Finding | Before | Change and regression evidence |
| --- | --- | --- |
| Rejected files | Unsupported types and excess files could disappear silently. | Shared picker reports rejections inline, announces them, identifies supported extensions, and has a keyboard focus indicator. Invalid-type recovery checked on every tool. |
| Hidden actions | File removal and page rotate/delete controls required hover. | Actions stay visible on touch screens and during keyboard navigation; file handles and page actions have specific accessible names. |
| Initial readiness | Static controls could look usable before their event handlers initialized, losing early file selections. | Keep the shared workspace disabled and announce preparation until React is ready; the browser suite waits for that visible readiness boundary. |
| Inspection/export consistency | Removal or setting changes could race asynchronous work; some tools briefly showed a previous page count. | Shared disabled fieldset, picker/slider busy context, announced status, and explicit inspection state across tools. A delayed-read regression holds inspection and export open, verifies controls are disabled, then replaces a 3-page PDF with a 1-page PDF. |
| Failed previews | Blank thumbnails had no explanation or recovery. | Shared preview feedback and Retry. A worker-asset availability check prevents PDF.js from caching a failed worker startup; a blocked worker followed by restored access now recovers without losing the file. Watermark preview redraws when rendering finishes and releases its document. |
| Unreadable merge inputs | A corrupt PDF remained at “Counting pages…”, and export remained possible with unreadable inputs. | Explicit per-file failure, removal guidance, and an export gate until every PDF is readable. Preview failures are distinct from unreadable document failures. |
| Malformed ranges | Inputs such as `1abc`, `1.5`, `1-2-3`, and `1,,2` could select unintended pages; separator-only split input could report zero parts. | Reject the whole malformed entry. Preserve valid whitespace, sorting, and deduplication. Unit tests and browser error/recovery checks. |
| Output names | Entering `combined.pdf` or `pictures.pdf` produced a duplicate suffix. | Strip one existing `.pdf` suffix before export; browser checks assert actual download names. |
| Reorder recovery | Deleting every page hid Undo. Undo snapshots were changed inside React state updaters. | Keep the toolbar available with zero remaining pages, and record undo once in the action handler. Browser checks delete all, undo one action at a time, and inspect exported rotation. |
| Touch drawing | Real browser touch events produced no whiteout or redaction box. Leaving the editing area could strand a gesture. | Primary pointer events, pointer capture, cancellation cleanup, and page-bounded coordinates. Browser touch and mouse/export checks preserve the existing PDF coordinate transforms. New whiteout/text rectangles also enter editor undo history. |
| HTML conversion race | A 50ms fallback could render a detached iframe document and fail intermittently. | Wait for the actual `srcdoc` load, with a bounded timeout and actionable error; export the same HTML three times in succession. |
| Password failures | The PDF library returned `isAuthenticated: false` for incorrect credentials, but protection changes could still proceed and report success. | Require authentication before changing encryption. Test incorrect-password recovery in both Protect and Unlock, then verify the original content survives an owner-password round trip. |
| Export identification | A selected source page could be named `page-1.png` regardless of its original page number. | Image ZIP entries retain original page numbers; subset export asserts `page-2.png` and `page-3.png`. |
| Labels and guidance | Several ranges/selects/sliders lacked an accessible name; editor copy described implementation difficulties rather than the task. | Associate labels with controls, label the focusable slider thumb, add native focus outlines, and explain editing in plain language. Explain that whiteout/overlay-only output retains underlying content and direct sensitive-document users to flattened redaction. |
| Small screens | Long split-result filenames could crowd the download action. | Allow result names to wrap; preserve visible actions, wrapping settings, and the current layout. Check empty and loaded states at 375px. |

## Coverage matrix

Every row includes empty state, rejected file type, keyboard-addressable controls, and a 375px layout check. All PDF-only tools also receive a corrupt PDF, recover, and load a valid file. Loading/export control consistency is source-audited across every row and exercised deterministically through the shared fieldset on Extract Pages. The browser suite checks unexpected JavaScript exceptions and document-processing network writes.

| Tool | Valid workflow/output verification | Additional recovery/interaction |
| --- | --- | --- |
| Edit PDF | Touch whiteout, edited 3-page PDF | Undo/redo; overlay guidance; pointer capture and coordinates |
| Redact PDF | Touch box, flattened 3-page PDF with the redacted page’s original text removed | Mouse/touch, cancellation, overlay-only guidance |
| Merge PDF | Two files produce 4 pages in keyboard-selected order | Corrupt input removal, preview retry, suffix, repeated export |
| Split PDF | Two ranges produce 2-page/1-page parts and a 2-entry ZIP | Range error recovery and visible download actions |
| Reorder Pages | Export preserves 3 pages and requested 90° rotation | Delete all, undo each deletion, visible actions |
| Extract Pages | Range `1,3` produces 2 pages | Invalid range, delayed inspection/export, replacement, preview failure/retry |
| Remove Pages | Remove source page 2, retain 2 pages | Selection and export gating |
| Rotate PDF | All 3 pages rotate 270° for 90° counter-clockwise | Direction/settings stay consistent during work |
| Images to PDF | Synthetic PNG produces 1-page PDF | Named output without duplicate suffix; visible rotate/remove actions |
| PDF to Images | Selected source pages 2–3 produce two PNGs in a ZIP | Filenames retain original page numbers |
| Add Watermark | Export contains the requested watermark text | Labelled sliders and preview completion redraw |
| Add Page Numbers | All 3 pages retained with added content | Labelled settings and page selection |
| Remove Metadata | Output retains 3 pages and removes synthetic title | Existing rebuild warning retained |
| Compress PDF | Rasterized output retains 3 pages | Existing lossy/flattening guidance and progress retained |
| Protect PDF | Protect a PDF, then update existing protection | Confirmation mismatch, incorrect current password, authenticated retry |
| Unlock PDF | Authenticated output retains 3 pages and original text | Incorrect password produces an error, then correct owner password succeeds |
| HTML to PDF | Inline synthetic HTML produces a 1-page PDF three times in succession | Named code field, actual iframe load wait, and consistent conversion lock |
| Packet Builder | Three PDF pages plus an image produce 4 pages | Step navigation, shared file actions, consistent export lock |

## Verification and reproduction

Use the repository's selected Node 24 runtime and Yarn 1.22.22. Dependency installation goes through Symphony's helper; no dependency pins changed.

```sh
export PATH="$(dirname "$SYMPHONY_NODE_EXECUTABLE"):$PATH"
node "$SYMPHONY_DEPENDENCY_HELPER" -- yarn install --frozen-lockfile --non-interactive --prefer-offline
git diff --check
yarn lint
node --experimental-strip-types --test scripts/*.test.mjs
yarn build
yarn test:seo .next/server/app
yarn build:cloudflare
yarn test:seo
```

The browser suite intentionally uses separately provisioned Playwright, keeping test tooling out of the application's dependencies. This audit used Playwright 1.58.2 / Chromium 145. Set `PDFKIT_PLAYWRIGHT_MODULE` to its absolute ESM entrypoint if it is not locally resolvable.

```sh
# Terminal 1, after the Node build
yarn start --port 3104

# Terminal 2
PDFKIT_BASE_URL=http://localhost:3104 \
PDFKIT_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
PDFKIT_UX_ARTIFACTS=/tmp/pdfkit-ux-26 \
node scripts/check-ux.mjs
```

The browser script generates its own synthetic PDFs, image, HTML, and encrypted files. It reads downloads locally to check page counts, order, rotations, content, and ZIP entries. It never uses personal documents. Optional `PDFKIT_UX_PHASE=exports` or `pointer` narrows a debugging run; the final audit uses the full default suite.

The configured `yarn preview:cloudflare --port 3103` was also exercised, but its local Workers runtime restarted during long QA runs. The complete suite therefore uses `yarn start`; this does not add document processing on the server. Static-export rendering/SEO checks pass independently.

Lint retains five existing `no-img-element` warnings for browser-generated previews. Build tools also report an outdated Browserslist database; dependency updates are outside this fix. The unit runner emits Node's existing module-type warning when importing TypeScript from this CommonJS package.

## Results

All checks above passed: 3 Node tests, the full 18-tool production-browser suite, both builds, and SEO checks for 21 rendered pages / 21 sitemap URLs / 19 free application offers in each output. The browser suite reported no uncaught page errors and no document-processing network writes. Lint had zero errors and the five existing image warnings.

## Evidence and limits

Before/after screenshots are under [docs/ux-audit-26](docs/ux-audit-26/). Full per-tool narrow-screen screenshots and synthetic fixtures are generated in the selected temporary artifacts directory.

Browser reproduction confirmed silent rejection, corrupt merge inspection, touch drawing failure, the HTML load race, and wrong-password false success. Other control/label/history findings were identified through source inspection and checked in the final browser flows. Desktop/narrow Chromium and emulated touch were exercised; this is not a physical-device, Safari/Firefox, full screen-reader, or large-document/low-memory certification. Canvas editing still relies on pointer input; the audit improves keyboard access to the existing controls and ordering workflows rather than introducing a new keyboard drawing editor.

The worker preflight requests only `/pdf.worker.min.mjs` with HEAD once per page session after success; failures can retry. It never sends filenames, page text, or document bytes. The default flattened-redaction behavior and browser-only transformation algorithms remain unchanged. HTML/compression/flattened redaction retain their existing rasterization limitations.
