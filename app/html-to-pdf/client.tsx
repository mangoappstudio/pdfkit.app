"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FileCode2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadFile } from "@/lib/download";
import { HTML_ACCEPT } from "@/lib/file-utils";

type PaperFormat = "a4" | "letter";
type Orientation = "portrait" | "landscape";
type SourceMode = "code" | "file";

const PAPER_MM: Record<PaperFormat, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

const PAPER_POINTS: Record<PaperFormat, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function mmToPoints(mm: number) {
  return (mm * 72) / 25.4;
}

function fileBaseName(name: string) {
  return name.replace(/\.(html|htm)$/i, "") || "document";
}

function wrapHtmlIfNeeded(input: string) {
  const s = input.trim();
  if (!s) return "";
  if (/<html[\s>]/i.test(s) || /<!doctype/i.test(s)) return s;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; background: #fff; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>
    ${s}
  </body>
</html>`;
}

async function waitForResources(doc: Document, timeoutMs: number) {
  const images = Array.from(doc.images ?? []);
  const waitImages = Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        })
    )
  );

  const fontsReady = "fonts" in doc ? (doc as Document & { fonts: FontFaceSet }).fonts.ready : undefined;
  const waitFonts = fontsReady ? fontsReady.catch(() => null) : Promise.resolve(null);

  await Promise.race([
    Promise.all([waitImages, waitFonts]).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode canvas image."))),
      "image/jpeg",
      quality
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export function HtmlToPDFClient() {
  const [mode, setMode] = useState<SourceMode>("code");
  const [htmlCode, setHtmlCode] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [format, setFormat] = useState<PaperFormat>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [maxHeightMmStr, setMaxHeightMmStr] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const pageMm = useMemo(() => {
    const base = PAPER_MM[format];
    return orientation === "portrait"
      ? { width: base.width, height: base.height }
      : { width: base.height, height: base.width };
  }, [format, orientation]);

  const defaultMaxHeightMm = useMemo(() => Math.round(pageMm.height), [pageMm.height]);

  const maxHeightMm = useMemo(() => {
    const raw = maxHeightMmStr.trim() ? Number(maxHeightMmStr) : defaultMaxHeightMm;
    if (!Number.isFinite(raw)) return defaultMaxHeightMm;
    return clamp(raw, 10, pageMm.height);
  }, [maxHeightMmStr, defaultMaxHeightMm, pageMm.height]);

  const canConvert = useMemo(() => {
    if (isProcessing) return false;
    if (mode === "file") return Boolean(htmlFile);
    return Boolean(htmlCode.trim());
  }, [isProcessing, mode, htmlCode, htmlFile]);

  const cleanupIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe) iframe.remove();
    iframeRef.current = null;
  }, []);

  const handleDropHtml = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setHtmlFile(f);
    toast.success(`Loaded ${f.name}`);
  }, []);

  const handleConvert = useCallback(async () => {
    if (!canConvert) return;
    setIsProcessing(true);

    try {
      const htmlRaw =
        mode === "file" ? await (htmlFile as File).text() : htmlCode;
      const srcdoc = wrapHtmlIfNeeded(htmlRaw);
      if (!srcdoc) throw new Error("Enter HTML code or upload an HTML file.");

      cleanupIframe();

      const iframe = document.createElement("iframe");
      iframeRef.current = iframe;
      iframe.setAttribute("sandbox", "allow-same-origin");
      iframe.style.position = "fixed";
      iframe.style.left = "-100000px";
      iframe.style.top = "0";
      iframe.style.border = "0";
      iframe.style.background = "white";
      iframe.style.opacity = "0";

      const widthPx = Math.round((pageMm.width * 96) / 25.4);
      iframe.style.width = `${clamp(widthPx, 320, 1400)}px`;
      iframe.style.height = "1px";

      iframe.srcdoc = srcdoc;
      document.body.appendChild(iframe);

      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        // srcdoc sometimes doesn't fire reliably in some engines; this is a fallback.
        setTimeout(() => resolve(), 50);
      });

      const doc = iframe.contentDocument;
      if (!doc) throw new Error("Could not render this HTML.");

      await waitForResources(doc, 3500);

      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(doc.body, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const maxPixels = 55_000_000;
      const pixelCount = canvas.width * canvas.height;
      if (!Number.isFinite(pixelCount) || pixelCount <= 0) {
        throw new Error("Rendering failed. Try simplifying the HTML.");
      }
      if (pixelCount > maxPixels) {
        throw new Error("This HTML is too large to render in the browser. Try reducing content or max height per page.");
      }

      const basePoints = PAPER_POINTS[format];
      const pageW = orientation === "portrait" ? basePoints.width : basePoints.height;
      const pageH = orientation === "portrait" ? basePoints.height : basePoints.width;

      const ptPerPx = pageW / Math.max(1, canvas.width);
      const sliceMaxPt = Math.min(mmToPoints(maxHeightMm), pageH);
      const sliceHeightPx = Math.max(1, Math.floor(sliceMaxPt / ptPerPx));

      const estimatedPages = Math.ceil(canvas.height / sliceHeightPx);
      const maxPages = 60;
      if (estimatedPages > maxPages) {
        throw new Error(`Too many pages to generate (${estimatedPages}). Try increasing max height per page or reducing content.`);
      }

      const pdfDoc = await PDFDocument.create();
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context.");

      for (let y = 0; y < canvas.height; y += sliceHeightPx) {
        const h = Math.min(sliceHeightPx, canvas.height - y);
        sliceCanvas.height = h;
        ctx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);

        const jpegBytes = await canvasToJpegBytes(sliceCanvas, 0.92);
        const image = await pdfDoc.embedJpg(jpegBytes);

        const imgHpt = h * ptPerPx;
        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(image, {
          x: 0,
          y: pageH - imgHpt,
          width: pageW,
          height: imgHpt,
        });
      }

      const out = await pdfDoc.save();
      const filenameBase =
        mode === "file" && htmlFile ? fileBaseName(htmlFile.name) : "html";
      downloadFile(out, `${filenameBase}.pdf`);
      toast.success("PDF downloaded!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to convert HTML to PDF.";
      toast.error(message);
    } finally {
      cleanupIframe();
      setIsProcessing(false);
    }
  }, [canConvert, mode, htmlCode, htmlFile, cleanupIframe, pageMm.width, format, orientation, maxHeightMm]);

  return (
    <ToolLayout
      title="HTML to PDF"
      description="Convert HTML code or an HTML file to PDF. Output is rasterized (screenshot-style)."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mode === "code" ? "default" : "outline"}
            onClick={() => setMode("code")}
          >
            Paste HTML code
          </Button>
          <Button
            type="button"
            variant={mode === "file" ? "default" : "outline"}
            onClick={() => setMode("file")}
          >
            Upload HTML file
          </Button>
        </div>

        {mode === "code" ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-gray-600" />
              <h2 className="text-sm font-semibold text-gray-800">HTML code</h2>
            </div>
            <textarea
              className="w-full min-h-[220px] rounded-lg border border-gray-200 bg-white p-3 text-sm font-mono"
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              placeholder={`<h1>Hello PDF</h1>\n<p>Inline styles work best.</p>`}
            />
            <p className="text-xs text-gray-400">
              Note: external resources (images, fonts, CSS URLs) may not load due to browser security restrictions. Inline styles and base64 images work best.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {!htmlFile ? (
              <DropZone
                onDrop={handleDropHtml}
                accept={HTML_ACCEPT}
                multiple={false}
                label="Drop an HTML file here or click to browse"
              />
            ) : (
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{htmlFile.name}</p>
                </div>
                <button
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  onClick={() => setHtmlFile(null)}
                >
                  Remove
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400">
              For best results, embed assets inline (CSS + base64 images). Scripts are blocked for safety.
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-800">PDF options</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <select
                id="format"
                className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value as PaperFormat)}
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orientation">Orientation</Label>
              <select
                id="orientation"
                className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-height">
              Max height per page (mm){" "}
              <span className="text-gray-400 font-normal">(default: {defaultMaxHeightMm}mm)</span>
            </Label>
            <Input
              id="max-height"
              type="number"
              inputMode="decimal"
              value={maxHeightMmStr}
              onChange={(e) => setMaxHeightMmStr(e.target.value)}
              placeholder={`${defaultMaxHeightMm}`}
              min={10}
              max={pageMm.height}
            />
            <p className="text-xs text-gray-400">
              Use a smaller value to force more page breaks. Page size stays {format.toUpperCase()}.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button onClick={handleConvert} disabled={!canConvert}>
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Converting…
              </>
            ) : (
              "Convert to PDF"
            )}
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
}
