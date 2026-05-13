export interface ToolSeoConfig {
  path: `/${string}`;
  title: string;
  description: string;
  bullets: string[];
  faqs?: Array<{ question: string; answer: string }>;
}

export const toolSeo: Record<string, ToolSeoConfig> = {
  "/edit-pdf": {
    path: "/edit-pdf",
    title: "Edit PDF",
    description: "Edit a PDF locally by applying overlay edits (cover + redraw), then export a new PDF.",
    bullets: [
      "Runs entirely in your browser (no uploads).",
      "Edit text by covering the original and drawing new text on top.",
      "Add new text boxes, whiteout regions, and freehand drawing.",
      "Exports a new PDF with your edits applied.",
    ],
    faqs: [
      {
        question: "Is this the same as editing in Adobe Acrobat?",
        answer:
          "Not exactly. True in-place editing of existing PDF content is hard to do reliably without a full PDF engine. This tool keeps everything local by applying edits as overlays (cover + redraw) and exporting a new PDF.",
      },
      {
        question: "Are my files uploaded?",
        answer: "No. All processing happens locally in your browser.",
      },
    ],
  },
  "/redact-pdf": {
    path: "/redact-pdf",
    title: "Redact PDF",
    description: "Cover sensitive information with black boxes before sharing a document.",
    bullets: [
      "Runs entirely in your browser (no uploads).",
      "Redact text and regions by drawing over the page.",
      "Export a new PDF with redactions applied.",
      "Best for visual redaction before sharing or uploading.",
    ],
    faqs: [
      {
        question: "Does this permanently remove the underlying text?",
        answer:
          "This tool applies visual redactions (covering areas). If you need certified redaction that removes underlying content, use a professional solution designed for that purpose.",
      },
      {
        question: "Are my files uploaded?",
        answer: "No. All processing happens locally in your browser.",
      },
    ],
  },
  "/merge-pdf": {
    path: "/merge-pdf",
    title: "Merge PDF",
    description: "Combine multiple PDFs into one file and reorder them before exporting.",
    bullets: [
      "Merge multiple PDFs into a single output file.",
      "Reorder inputs before merging.",
      "Runs locally in your browser (no uploads).",
      "Works best in modern browsers for large PDFs.",
    ],
  },
  "/split-pdf": {
    path: "/split-pdf",
    title: "Split PDF",
    description: "Split a PDF by page ranges or export each page as a separate PDF.",
    bullets: [
      "Split by page ranges or export every page.",
      "Keeps processing local in your browser.",
      "Useful for sharing only a portion of a document.",
      "Large PDFs may take longer depending on your device.",
    ],
  },
  "/reorder-pages": {
    path: "/reorder-pages",
    title: "Reorder Pages",
    description: "Drag and drop to reorder pages, rotate, or delete pages from a PDF.",
    bullets: [
      "Reorder pages with drag-and-drop.",
      "Rotate pages and remove unwanted pages.",
      "Export a new PDF after changes.",
      "Runs locally in your browser (no uploads).",
    ],
  },
  "/extract-pages": {
    path: "/extract-pages",
    title: "Extract Pages",
    description: "Select specific pages from a PDF and export them as a new file.",
    bullets: [
      "Pick only the pages you need.",
      "Export a new PDF containing the selected pages.",
      "Great for removing extra pages before sharing.",
      "All processing happens locally in your browser.",
    ],
  },
  "/remove-pages": {
    path: "/remove-pages",
    title: "Remove Pages",
    description: "Remove selected pages and export the remaining PDF.",
    bullets: [
      "Select pages to remove, then export the rest.",
      "Helps avoid sharing internal or irrelevant pages.",
      "Runs locally in your browser (no uploads).",
      "Fast for small and medium PDFs; device-dependent for large files.",
    ],
  },
  "/images-to-pdf": {
    path: "/images-to-pdf",
    title: "Images to PDF",
    description: "Convert JPG, PNG, or WebP images into a single PDF.",
    bullets: [
      "Combine multiple images into one PDF.",
      "Reorder images before export.",
      "Runs entirely in your browser (no uploads).",
      "Output quality depends on the source images.",
    ],
  },
  "/pdf-to-images": {
    path: "/pdf-to-images",
    title: "PDF to Images",
    description: "Export selected pages as PNG or JPEG images (zipped).",
    bullets: [
      "Choose pages and export as images.",
      "PNG or JPEG output with a downloadable zip.",
      "Runs locally in your browser (no uploads).",
      "Image export can be memory-intensive on very large PDFs.",
    ],
  },
  "/add-watermark": {
    path: "/add-watermark",
    title: "Add Watermark",
    description: "Add a text watermark to every page of a PDF before sharing.",
    bullets: [
      "Add a watermark across all pages.",
      "Useful for “DRAFT”, “CONFIDENTIAL”, or review copies.",
      "Runs locally in your browser (no uploads).",
      "Export a new watermarked PDF.",
    ],
  },
  "/add-page-numbers": {
    path: "/add-page-numbers",
    title: "Add Page Numbers",
    description: "Add simple pagination to a PDF for filing or printing.",
    bullets: [
      "Add page numbers to every page.",
      "Helps recipients reference pages accurately.",
      "Runs locally in your browser (no uploads).",
      "Exports a new PDF with pagination applied.",
    ],
  },
  "/remove-metadata": {
    path: "/remove-metadata",
    title: "Remove Metadata",
    description: "Rebuild a PDF locally to scrub document metadata before sharing.",
    bullets: [
      "Removes common metadata by rebuilding the file locally.",
      "Useful before uploading sensitive documents.",
      "Runs entirely in your browser (no uploads).",
      "Exports a new PDF with metadata scrubbed.",
    ],
  },
  "/compress-pdf": {
    path: "/compress-pdf",
    title: "Compress PDF",
    description: "Compress scanned PDFs by flattening pages (lossy) to reduce file size.",
    bullets: [
      "Best for scanned/image-heavy PDFs.",
      "Compression is lossy (pages are flattened).",
      "Runs locally in your browser (no uploads).",
      "Export a new compressed PDF.",
    ],
  },
  "/protect-pdf": {
    path: "/protect-pdf",
    title: "Protect PDF",
    description: "Password-protect a PDF and optionally set viewer permissions before sharing.",
    bullets: [
      "Add password protection (AES/RC4 options).",
      "Optionally set PDF permissions (print, copy, edit, etc.).",
      "Runs entirely in your browser (no uploads).",
      "Download a protected PDF instantly.",
    ],
    faqs: [
      {
        question: "Are my files uploaded?",
        answer: "No. All PDF processing happens locally in your browser.",
      },
      {
        question: "What is the owner password?",
        answer:
          "The owner password grants full access and may be required to remove protection or change permissions in some PDFs. If you set one, store it securely.",
      },
    ],
  },
  "/unlock-pdf": {
    path: "/unlock-pdf",
    title: "Unlock PDF",
    description: "Remove password protection from a PDF when you know the password.",
    bullets: [
      "Remove password protection from an encrypted PDF.",
      "Try user password first; owner password may be required.",
      "Runs locally in your browser (no uploads).",
      "Download an unlocked copy after processing.",
    ],
    faqs: [
      {
        question: "Do I need the owner password?",
        answer:
          "Sometimes. Some PDFs allow opening with a user password but require the owner password to remove protection or permissions.",
      },
      {
        question: "Will this work on every PDF?",
        answer:
          "Most modern encrypted PDFs should work, but some files (or uncommon protection settings) may not be supported by all browsers and viewers.",
      },
    ],
  },
  "/rotate-pdf": {
    path: "/rotate-pdf",
    title: "Rotate PDF",
    description: "Rotate every page in a PDF by 90°, 180°, or 270°.",
    bullets: [
      "Rotate all pages in one click.",
      "Choose direction and angle.",
      "Runs entirely in your browser (no uploads).",
      "For per-page rotation, use Reorder Pages.",
    ],
  },
  "/html-to-pdf": {
    path: "/html-to-pdf",
    title: "HTML to PDF",
    description: "Convert HTML code or an HTML file into a downloadable PDF (rasterized).",
    bullets: [
      "Paste HTML or upload an .html file.",
      "Choose A4/Letter and portrait/landscape.",
      "Output is screenshot-style (rasterized).",
      "Runs locally in your browser (no uploads).",
    ],
    faqs: [
      {
        question: "Is the output selectable text?",
        answer:
          "No. This tool renders HTML to a canvas and embeds images into the PDF, so the output is rasterized (like a screenshot).",
      },
      {
        question: "Will external images and fonts load?",
        answer:
          "Not always. Browser security restrictions can block external resources. Inline styles and embedded (base64) assets work best.",
      },
    ],
  },
  "/prepare": {
    path: "/prepare",
    title: "Document Packet Builder",
    description: "Assemble multiple files into one organized PDF packet before sharing.",
    bullets: [
      "Combine multiple PDFs into a final packet.",
      "Organize documents in the right order before exporting.",
      "Add optional finishing touches (like a cover title/watermark when supported).",
      "Runs entirely in your browser (no uploads).",
    ],
  },
};
