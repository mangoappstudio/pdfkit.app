import type { Metadata } from "next";
import { ReorderPagesClient } from "./client";
import { StructuredData } from "@/components/structured-data";
import { ToolSeoFooter } from "@/components/tool-seo-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { toolSeo } from "@/lib/tool-seo";

const seo = toolSeo["/reorder-pages"];

export const metadata: Metadata = {
  title: "Reorder Pages",
  description: "Drag and drop to reorder PDF pages, rotate or delete pages. All processing in your browser.",
  alternates: {
    canonical: "/reorder-pages",
  },
};

export default function ReorderPagesPage() {
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
      <ReorderPagesClient />
      <ToolSeoFooter title={seo.title} description={seo.description} learnMoreHref="/privacy" bullets={seo.bullets} />
    </>
  );
}
