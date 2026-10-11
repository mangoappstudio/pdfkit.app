import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

type PageMetadata = {
  title?: string;
  description?: string;
  alternates: { canonical: string };
};

// Next.js replaces nested metadata rather than merging it. Include the images
// here so route-specific social titles do not discard the shared preview image.
export function createPageMetadata(metadata: PageMetadata): Metadata {
  const title = metadata.title
    ? `${metadata.title} | ${SITE_NAME}`
    : "PDFKit.app – Prepare Sensitive PDFs Privately";
  const description = metadata.description ?? SITE_DESCRIPTION;

  return {
    ...metadata,
    openGraph: {
      title,
      description,
      url: metadata.alternates.canonical,
      type: "website",
      siteName: SITE_NAME,
      images: [{
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "PDFKit.app – Prepare Sensitive PDFs Privately",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{
        url: "/twitter-image.png",
        width: 1200,
        height: 630,
        alt: "PDFKit.app – Prepare Sensitive PDFs Privately",
      }],
    },
  };
}
