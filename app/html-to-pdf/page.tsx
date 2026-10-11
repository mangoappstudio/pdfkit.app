import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/metadata";
import { HtmlToPDFClient } from "./client";
import { StructuredData } from "@/components/structured-data";
import { ToolSeoFooter } from "@/components/tool-seo-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { toolSeo } from "@/lib/tool-seo";

const seo = toolSeo["/html-to-pdf"];

export const metadata: Metadata = createPageMetadata({
  title: "HTML to PDF",
  description: "Convert HTML code or an HTML file into a downloadable PDF. Processed entirely in your browser.",
  alternates: {
    canonical: "/html-to-pdf",
  },
});

export default function HtmlToPDFPage() {
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
      <HtmlToPDFClient />
      <ToolSeoFooter title={seo.title} description={seo.description} learnMoreHref="/privacy" bullets={seo.bullets} />
    </>
  );
}

