import { PDFDocument, degrees, rgb, StandardFonts, PDFFont } from "pdf-lib";

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

export interface ImagesToPdfOptions {
  margin?: number; // PDF points
  backgroundColor?: { r: number; g: number; b: number };
  jpegQuality?: number; // 0-1, when set re-encodes via canvas
  rotations?: number[]; // degrees per image (0/90/180/270)
}

async function fileToEmbeddedImageBytes(
  file: File,
  opts: { rotation: number; jpegQuality?: number; backgroundColor?: { r: number; g: number; b: number } }
): Promise<{ bytes: ArrayBuffer; kind: "jpg" | "png" }> {
  const { rotation, jpegQuality, backgroundColor } = opts;
  const bytes = await file.arrayBuffer();
  const mimeType = file.type.toLowerCase();

  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const needsCanvas = normalizedRotation !== 0 || jpegQuality !== undefined;
  if (!needsCanvas) {
    if (mimeType === "image/jpeg" || mimeType === "image/jpg") return { bytes, kind: "jpg" };
    if (mimeType === "image/png") return { bytes, kind: "png" };
    // Fall back to png for other types by re-encoding.
  }

  const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    bitmap = null;
  }

  if (!bitmap) {
    // Fallback path if createImageBitmap isn't available
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not decode image."));
        el.src = url;
      });
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const rot = normalizedRotation;
      const canvas = document.createElement("canvas");
      canvas.width = rot === 90 || rot === 270 ? h : w;
      canvas.height = rot === 90 || rot === 270 ? w : h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context.");
      if (backgroundColor || jpegQuality !== undefined) {
        const bg = backgroundColor ?? { r: 1, g: 1, b: 1 };
        ctx.fillStyle = `rgb(${Math.round(bg.r * 255)},${Math.round(bg.g * 255)},${Math.round(bg.b * 255)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      const outKind: "jpg" | "png" =
        jpegQuality !== undefined || mimeType === "image/jpeg" || mimeType === "image/jpg" ? "jpg" : "png";
      const outType = outKind === "jpg" ? "image/jpeg" : "image/png";
      const outQuality = outKind === "jpg" ? (jpegQuality ?? 0.92) : undefined;
      const outBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image."))), outType, outQuality);
      });
      return { bytes: await outBlob.arrayBuffer(), kind: outKind };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const rot = normalizedRotation;
  const canvas = document.createElement("canvas");
  canvas.width = rot === 90 || rot === 270 ? bitmap.height : bitmap.width;
  canvas.height = rot === 90 || rot === 270 ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("Could not create canvas context.");
  }
  if (backgroundColor || jpegQuality !== undefined) {
    const bg = backgroundColor ?? { r: 1, g: 1, b: 1 };
    ctx.fillStyle = `rgb(${Math.round(bg.r * 255)},${Math.round(bg.g * 255)},${Math.round(bg.b * 255)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close?.();

  const outKind: "jpg" | "png" =
    jpegQuality !== undefined || mimeType === "image/jpeg" || mimeType === "image/jpg" ? "jpg" : "png";
  const outType = outKind === "jpg" ? "image/jpeg" : "image/png";
  const outQuality = outKind === "jpg" ? (jpegQuality ?? 0.92) : undefined;
  const outBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image."))), outType, outQuality);
  });
  return { bytes: await outBlob.arrayBuffer(), kind: outKind };
}

export async function imagesToPDF(
  files: File[],
  fitMode: PageFitMode = "fit-to-image",
  options: ImagesToPdfOptions = {}
): Promise<Uint8Array> {
  const { margin = 18, backgroundColor, jpegQuality, rotations = [] } = options;
  const pdfDoc = await PDFDocument.create();
  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx]!;
    const rotation = rotations[idx] ?? 0;
    const embedSource = await fileToEmbeddedImageBytes(file, { rotation, jpegQuality, backgroundColor });
    const image =
      embedSource.kind === "jpg"
        ? await pdfDoc.embedJpg(embedSource.bytes)
        : await pdfDoc.embedPng(embedSource.bytes);
    const { width: imgW, height: imgH } = image;
    let pageW: number, pageH: number;
    if (fitMode === "fit-to-image") {
      pageW = imgW;
      pageH = imgH;
    } else {
      [pageW, pageH] = PAGE_SIZES[fitMode] ?? [imgW, imgH];
    }
    const page = pdfDoc.addPage([pageW, pageH]);

    if (fitMode !== "fit-to-image" && backgroundColor) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageW,
        height: pageH,
        color: rgb(backgroundColor.r, backgroundColor.g, backgroundColor.b),
        opacity: 1,
      });
    }

    const availableW = fitMode === "fit-to-image" ? pageW : Math.max(1, pageW - margin * 2);
    const availableH = fitMode === "fit-to-image" ? pageH : Math.max(1, pageH - margin * 2);
    const scale = Math.min(availableW / imgW, availableH / imgH);
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
  pageIndices?: number[]; // optional 0-based page indices to apply to
  position?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  tiled?: boolean;
  margin?: number; // points
  tileGap?: number; // points
}

export async function addWatermark(
  file: File,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const {
    text,
    opacity,
    rotation,
    fontSize,
    color = { r: 0.5, g: 0.5, b: 0.5 },
    pageIndices,
    position = "center",
    tiled = false,
    margin = 24,
    tileGap = Math.max(120, fontSize * 4),
  } = options;
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const applySet = pageIndices ? new Set(pageIndices) : null;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex]!;
    if (applySet && !applySet.has(pageIndex)) continue;
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const getAnchor = () => {
      if (position === "top-left") return { x: margin, y: height - margin - fontSize };
      if (position === "top-right") return { x: width - margin - textWidth, y: height - margin - fontSize };
      if (position === "bottom-left") return { x: margin, y: margin };
      if (position === "bottom-right") return { x: width - margin - textWidth, y: margin };
      return { x: (width - textWidth) / 2, y: height / 2 };
    };

    if (!tiled) {
      const { x, y } = getAnchor();
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        opacity,
        rotate: degrees(rotation),
        color: rgb(color.r, color.g, color.b),
      });
      continue;
    }

    for (let x = -width; x <= width * 2; x += tileGap) {
      for (let y = -height; y <= height * 2; y += tileGap) {
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
    }
  }
  return pdfDoc.save();
}

export interface CoverPageOptions {
  title: string;
  note?: string;
  margin?: number; // points
  titleFontSize?: number; // points
  noteFontSize?: number; // points
}

function truncateWithEllipsisToFit(
  font: PDFFont,
  text: string,
  fontSize: number,
  maxWidth: number
): string {
  const ellipsis = "…";
  const trimmed = text.trimEnd();
  if (!trimmed) return ellipsis;
  const fits = (s: string) => font.widthOfTextAtSize(s, fontSize) <= maxWidth;
  if (fits(trimmed)) return trimmed;
  let current = trimmed;
  while (current.length > 0 && !fits(current + ellipsis)) {
    current = current.slice(0, -1).trimEnd();
  }
  return (current || "").trimEnd() + ellipsis;
}

function wrapLine(font: PDFFont, line: string, fontSize: number, maxWidth: number): string[] {
  const raw = line.trimEnd();
  if (!raw) return [""];
  const words = raw.split(/\s+/g);
  const out: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    // Extremely long word: hard-cut to fit.
    if (font.widthOfTextAtSize(w, fontSize) <= maxWidth) {
      current = w;
    } else {
      let cut = w;
      while (cut.length > 1 && font.widthOfTextAtSize(cut, fontSize) > maxWidth) {
        cut = cut.slice(0, -1);
      }
      out.push(cut);
      current = w.slice(cut.length).trim();
      if (current) {
        // Recursively wrap the remainder.
        wrapLine(font, current, fontSize, maxWidth).forEach((l) => out.push(l));
        current = "";
      }
    }
  }
  if (current) out.push(current);
  return out;
}

function wrapText(font: PDFFont, text: string, fontSize: number, maxWidth: number): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    wrapLine(font, line, fontSize, maxWidth).forEach((l) => out.push(l));
  }
  return out;
}

export async function addCoverPage(file: File, options: CoverPageOptions): Promise<Uint8Array> {
  const { title, note, margin = 72, titleFontSize = 28, noteFontSize = 12 } = options;
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0] ?? null;
  const size = firstPage ? firstPage.getSize() : null;

  const coverPage = size ? pdfDoc.insertPage(0, [size.width, size.height]) : pdfDoc.insertPage(0);
  const { width, height } = coverPage.getSize();

  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const noteFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const maxTextWidth = Math.max(1, width - margin * 2);

  const titleTrimmed = (title ?? "").toString().trim();
  const safeTitle = titleTrimmed ? titleTrimmed : "Document Packet";
  const titleText = truncateWithEllipsisToFit(titleFont, safeTitle, titleFontSize, maxTextWidth);
  const titleWidth = titleFont.widthOfTextAtSize(titleText, titleFontSize);

  const titleX = (width - titleWidth) / 2;
  const titleY = height - margin - titleFontSize;
  coverPage.drawText(titleText, {
    x: titleX,
    y: titleY,
    size: titleFontSize,
    font: titleFont,
    color: rgb(0, 0, 0),
    opacity: 1,
  });

  const noteTrimmed = (note ?? "").toString().trim();
  if (noteTrimmed) {
    const gap = Math.max(18, titleFontSize * 0.6);
    let y = titleY - gap;
    const lineHeight = noteFontSize * 1.4;
    const minY = margin;

    const lines = wrapText(noteFont, noteTrimmed, noteFontSize, maxTextWidth);
    const visible: string[] = [];
    for (const line of lines) {
      if (y - noteFontSize < minY) break;
      visible.push(line);
      y -= lineHeight;
    }

    const truncated = visible.length < lines.length;
    if (visible.length > 0 && truncated) {
      const lastIdx = visible.length - 1;
      visible[lastIdx] = truncateWithEllipsisToFit(noteFont, visible[lastIdx] ?? "", noteFontSize, maxTextWidth);
    }

    // Reset y to start position and draw the visible lines.
    y = titleY - gap;
    for (const line of visible) {
      coverPage.drawText(line, {
        x: margin,
        y,
        size: noteFontSize,
        font: noteFont,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 1,
      });
      y -= lineHeight;
    }
  }

  return pdfDoc.save();
}

// Get page count from a file
export async function getPDFPageCount(file: File): Promise<number> {
  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPageCount();
}

// A single redaction box: page index (0-based) and coordinates in PDF points (bottom-left origin)
export interface RedactionBox {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Apply filled black rectangles over the specified areas to visually redact content
export async function redactPDF(file: File, boxes: RedactionBox[]): Promise<Uint8Array> {
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();
  for (const box of boxes) {
    const page = pages[box.pageIndex];
    if (!page) continue;
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      color: rgb(0, 0, 0),
      opacity: 1,
    });
  }
  return pdfDoc.save();
}

export type AddPageNumbersFormat =
  | "current-over-total"
  | "current"
  | "page-current"
  | "page-current-of-total";

export type AddPageNumbersPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

export interface AddPageNumbersOptions {
  pageIndices?: number[]; // optional 0-based page indices to apply to; when set, numbering is sequential within the selection
  format?: AddPageNumbersFormat;
  startNumber?: number; // default 1
  position?: AddPageNumbersPosition;
  fontSize?: number; // default 11
  margin?: number; // default 24 (PDF points)
  color?: { r: number; g: number; b: number }; // 0-1
}

export async function addPageNumbers(file: File, options: AddPageNumbersOptions = {}): Promise<Uint8Array> {
  const {
    pageIndices,
    format = "current-over-total",
    startNumber = 1,
    position = "bottom-center",
    fontSize = 11,
    margin = 24,
    color = { r: 0.2, g: 0.2, b: 0.2 },
  } = options;

  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const unique = pageIndices ? [...new Set(pageIndices)] : null;
  const indices = unique ? unique.filter((i) => i >= 0 && i < pages.length).sort((a, b) => a - b) : null;
  const applyAll = !indices || indices.length === 0;
  const applyList = applyAll ? pages.map((_, i) => i) : indices;
  const totalForLabel = applyAll ? pages.length : applyList.length;

  const formatLabel = (n: number) => {
    if (format === "current") return `${n}`;
    if (format === "page-current") return `Page ${n}`;
    if (format === "page-current-of-total") return `Page ${n} of ${totalForLabel}`;
    return `${n} / ${totalForLabel}`;
  };

  for (let seqIndex = 0; seqIndex < applyList.length; seqIndex++) {
    const pageIndex = applyList[seqIndex]!;
    const page = pages[pageIndex];
    if (!page) continue;

    const currentNumber = Math.max(1, Math.floor(startNumber)) + (applyAll ? pageIndex : seqIndex);
    const label = formatLabel(currentNumber);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, fontSize);

    const x =
      position === "bottom-left" || position === "top-left"
        ? margin
        : position === "bottom-right" || position === "top-right"
        ? width - margin - textWidth
        : (width - textWidth) / 2;

    const y =
      position === "top-left" || position === "top-right"
        ? height - margin - fontSize
        : margin;

    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity: 1,
    });
  }

  return pdfDoc.save();
}

export async function deepScrubPDF(file: File): Promise<Uint8Array> {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const copiedPages = await out.copyPages(src, src.getPageIndices());
  copiedPages.forEach((page) => out.addPage(page));
  return out.save();
}
