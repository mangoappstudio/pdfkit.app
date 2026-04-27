import type { Metadata } from "next";
import { SplitPDFClient } from "./client";
import { StructuredData } from "@/components/structured-data";
import { ToolSeoFooter } from "@/components/tool-seo-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { toolSeo } from "@/lib/tool-seo";

const seo = toolSeo["/split-pdf"];

export const metadata: Metadata = {
  title: "Split PDF",
  description: "Split a PDF by page ranges or extract every page as a separate file. All processing in your browser.",
  alternates: {
    canonical: "/split-pdf",
  },
};

export default function SplitPDFPage() {
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
      <SplitPDFClient />
      <ToolSeoFooter title={seo.title} description={seo.description} learnMoreHref="/privacy" bullets={seo.bullets} />
    </>
  );
}
