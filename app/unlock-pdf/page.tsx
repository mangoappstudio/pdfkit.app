import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/metadata";
import { UnlockPDFClient } from "./client";
import { StructuredData } from "@/components/structured-data";
import { ToolSeoFooter } from "@/components/tool-seo-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { toolSeo } from "@/lib/tool-seo";

const seo = toolSeo["/unlock-pdf"];

export const metadata: Metadata = createPageMetadata({
  title: "Unlock PDF",
  description: "Remove password protection from a PDF (when you know the password). Processed entirely in your browser.",
  alternates: {
    canonical: "/unlock-pdf",
  },
});

export default function UnlockPDFPage() {
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
      <UnlockPDFClient />
      <ToolSeoFooter title={seo.title} description={seo.description} learnMoreHref="/privacy" bullets={seo.bullets} />
    </>
  );
}

