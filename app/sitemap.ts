import type { MetadataRoute } from "next";

const baseUrl = "https://www.pdfkit.app";

const routes = [
  "/",
  "/about",
  "/privacy",
  "/redact-pdf",
  "/extract-pages",
  "/remove-pages",
  "/add-watermark",
  "/add-page-numbers",
  "/remove-metadata",
  "/merge-pdf",
  "/prepare",
  "/split-pdf",
  "/reorder-pages",
  "/images-to-pdf",
  "/pdf-to-images",
  "/compress-pdf",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: `${baseUrl}${route === "/" ? "" : route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}

