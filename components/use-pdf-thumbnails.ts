"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface UsePdfThumbnailsOptions {
  width?: number;
  maxScale?: number;
  yieldEvery?: number;
}

export function usePdfThumbnails(
  file: File | null,
  pageCount: number,
  { width = 160, maxScale = 1, yieldEvery = 1 }: UsePdfThumbnailsOptions = {}
) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderedCount, setRenderedCount] = useState(0);

  const urlsRef = useRef<string[]>([]);
  const generationIdRef = useRef(0);

  const revokeAll = useCallback(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }, []);

  const reset = useCallback(() => {
    generationIdRef.current += 1;
    revokeAll();
    setUrls([]);
    setRenderedCount(0);
    setIsRendering(false);
  }, [revokeAll]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!file || pageCount <= 0) {
        reset();
        return;
      }

      const generationId = ++generationIdRef.current;
      const fileForThumbs = file;
      const pageCountForThumbs = pageCount;

      setUrls(Array.from({ length: pageCountForThumbs }, () => null));
      setRenderedCount(0);
      setIsRendering(true);

      let pdfDoc: PDFDocumentProxy | null = null;
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const arrayBuffer = await fileForThumbs.arrayBuffer();
        pdfDoc = await (pdfjsLib.getDocument({ data: arrayBuffer }).promise as Promise<PDFDocumentProxy>);

        const totalPages = Math.min(pageCountForThumbs, pdfDoc.numPages ?? pageCountForThumbs);
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          if (cancelled || generationId !== generationIdRef.current) return;

          const page = await pdfDoc.getPage(pageIndex + 1);
          const viewport = page.getViewport({ scale: 1 });
          const scale = Math.min(width / viewport.width, maxScale);
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.ceil(scaledViewport.width));
          canvas.height = Math.max(1, Math.ceil(scaledViewport.height));

          await page.render({ canvas, viewport: scaledViewport }).promise;
          if (cancelled || generationId !== generationIdRef.current) return;

          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to generate thumbnail."))), "image/png");
          });
          if (cancelled || generationId !== generationIdRef.current) return;

          const url = URL.createObjectURL(blob);
          if (cancelled || generationId !== generationIdRef.current) {
            URL.revokeObjectURL(url);
            return;
          }

          urlsRef.current[pageIndex] = url;
          setUrls((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            next[pageIndex] = url;
            return next;
          });
          setRenderedCount((n) => n + 1);

          if (yieldEvery > 0 && (pageIndex + 1) % yieldEvery === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      } catch {
        // Callers can display their own error UI; keep this hook silent.
      } finally {
        try {
          await pdfDoc?.destroy?.();
        } catch {
          // ignore
        }
        if (!cancelled && generationId === generationIdRef.current) setIsRendering(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      revokeAll();
    };
  }, [file, pageCount, width, maxScale, yieldEvery, reset, revokeAll]);

  return { urls, isRendering, renderedCount, reset };
}
