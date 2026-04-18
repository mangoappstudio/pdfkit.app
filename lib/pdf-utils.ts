import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";

// Merge multiple PDF files into one
export async function mergePDFs(files: File[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  return mergedPdf.save();
}

// Parse a page range string like "1-3,5,8-10" into zero-based page indices
export function parsePageRanges(rangeStr: string, totalPages: number): number[] {
  const indices: number[] = [];
  const parts = rangeStr.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((s) => parseInt(s.trim(), 10));
      if (isNaN(start) || isNaN(end)) throw new Error(`Invalid range: ${part}`);
      if (start < 1 || end > totalPages || start > end) {
        throw new Error(`Range ${part} is out of bounds (document has ${totalPages} pages)`);
      }
      for (let i = start; i <= end; i++) indices.push(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (isNaN(n)) throw new Error(`Invalid page number: ${part}`);
      if (n < 1 || n > totalPages) {
        throw new Error(`Page ${n} is out of bounds (document has ${totalPages} pages)`);
      }
      indices.push(n - 1);
    }
  }
  // Deduplicate and sort
  return [...new Set(indices)].sort((a, b) => a - b);
}

// Split PDF into multiple PDFs by page ranges
export async function splitPDFByRanges(
  file: File,
  ranges: number[][]
): Promise<Uint8Array[]> {
  const bytes = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(bytes);
  const results: Uint8Array[] = [];
  for (const range of ranges) {
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(srcPdf, range);
    copiedPages.forEach((page) => newPdf.addPage(page));
    results.push(await newPdf.save());
  }
  return results;
}

// Split PDF into individual pages
export async function splitPDFIntoPages(file: File): Promise<Uint8Array[]> {
  const bytes = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(bytes);
  const count = srcPdf.getPageCount();
  const results: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(srcPdf, [i]);
    newPdf.addPage(page);
    results.push(await newPdf.save());
  }
  return results;
}

// Reorder/rotate/delete pages and return new PDF
export async function reorderPages(
  file: File,
  pageOrder: number[],
  rotations: Record<number, number>
): Promise<Uint8Array> {
  const bytes = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(bytes);
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(srcPdf, pageOrder);
  copiedPages.forEach((page, idx) => {
    const originalIndex = pageOrder[idx];
    const rotation = rotations[originalIndex] ?? 0;
    if (rotation !== 0) {
      page.setRotation(degrees(rotation));
    }
    newPdf.addPage(page);
  });
  return newPdf.save();
}

// Extract specific pages (0-based indices)
export async function extractPages(file: File, pageIndices: number[]): Promise<Uint8Array> {
  const bytes = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(bytes);
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));
  return newPdf.save();
}

// Convert images to PDF
export type PageFitMode = "fit-to-image" | "a4" | "letter";

const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export async function imagesToPDF(
  files: File[],
  fitMode: PageFitMode = "fit-to-image"
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    let image;
    const mimeType = file.type.toLowerCase();
    if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      image = await pdfDoc.embedJpg(bytes);
    } else if (mimeType === "image/png") {
      image = await pdfDoc.embedPng(bytes);
    } else {
      // Try PNG first, then JPEG
      try {
        image = await pdfDoc.embedPng(bytes);
      } catch {
        image = await pdfDoc.embedJpg(bytes);
      }
    }
    const { width: imgW, height: imgH } = image;
    let pageW: number, pageH: number;
    if (fitMode === "fit-to-image") {
      pageW = imgW;
      pageH = imgH;
    } else {
      [pageW, pageH] = PAGE_SIZES[fitMode] ?? [imgW, imgH];
    }
    const page = pdfDoc.addPage([pageW, pageH]);
    const scale = Math.min(pageW / imgW, pageH / imgH);
    const scaledW = imgW * scale;
    const scaledH = imgH * scale;
    const x = (pageW - scaledW) / 2;
    const y = (pageH - scaledH) / 2;
    page.drawImage(image, { x, y, width: scaledW, height: scaledH });
  }
  return pdfDoc.save();
}

// Add text watermark to all pages
export interface WatermarkOptions {
  text: string;
  opacity: number; // 0-1
  rotation: number; // degrees
  fontSize: number;
  color?: { r: number; g: number; b: number };
}

export async function addWatermark(
  file: File,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const { text, opacity, rotation, fontSize, color = { r: 0.5, g: 0.5, b: 0.5 } } = options;
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const x = (width - textWidth * Math.cos((rotation * Math.PI) / 180)) / 2;
    const y = (height - fontSize * Math.sin((rotation * Math.PI) / 180)) / 2;
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      opacity,
      rotate: degrees(rotation),
      color: rgb(color.r, color.g, color.b),
    });
  }
  return pdfDoc.save();
}

// Get page count from a file
export async function getPDFPageCount(file: File): Promise<number> {
  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPageCount();
}
