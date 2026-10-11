import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/metadata";
import { PdfToImagesClient } from "./client";
import { StructuredData } from "@/components/structured-data";
import { ToolSeoFooter } from "@/components/tool-seo-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { toolSeo } from "@/lib/tool-seo";

const seo = toolSeo["/pdf-to-images"];

export const metadata: Metadata = createPageMetadata({
  title: "PDF to Images",
  description: "Export selected PDF pages as PNG or JPEG images. All processing in your browser.",
  alternates: {
    canonical: "/pdf-to-images",
  },
});

export default function PdfToImagesPage() {
  const url = `${SITE_URL}${seo.path}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: `${seo.title} | ${SITE_NAME}`,
        description: metadata.description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "SoftwareApplication",
        name: `${SITE_NAME} – ${seo.title}`,
        url,
        description: metadata.description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: 0 },
      },
    ],
  } as const;

  return (
    <>
      <StructuredData data={structuredData} />
      <PdfToImagesClient />
      <ToolSeoFooter title={seo.title} description={seo.description} learnMoreHref="/privacy" bullets={seo.bullets} />
    </>
  );
}
