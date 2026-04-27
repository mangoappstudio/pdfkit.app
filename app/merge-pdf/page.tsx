import type { Metadata } from "next";
import { MergePDFClient } from "./client";
import { StructuredData } from "@/components/structured-data";
import { ToolSeoFooter } from "@/components/tool-seo-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { toolSeo } from "@/lib/tool-seo";

const seo = toolSeo["/merge-pdf"];

export const metadata: Metadata = {
  title: "Merge PDF",
  description: "Combine multiple PDF files into one. Reorder files before merging. Processed entirely in your browser.",
  alternates: {
    canonical: "/merge-pdf",
  },
};

export default function MergePDFPage() {
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
      },
    ],
  } as const;

  return (
    <>
      <StructuredData data={structuredData} />
      <MergePDFClient />
      <ToolSeoFooter title={seo.title} description={seo.description} learnMoreHref="/privacy" bullets={seo.bullets} />
    </>
  );
}
