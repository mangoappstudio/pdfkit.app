export interface ToolSeoConfig {
  path: `/${string}`;
  title: string;
  description: string;
  bullets: string[];
  faqs?: Array<{ question: string; answer: string }>;
}

export const toolSeo: Record<string, ToolSeoConfig> = {
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

