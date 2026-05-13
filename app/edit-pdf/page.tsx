import type { Metadata } from "next";
import { StructuredData } from "@/components/structured-data";
import { ToolSeoFooter } from "@/components/tool-seo-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { toolSeo } from "@/lib/tool-seo";
import { EditPDFClient } from "./client";

const seo = toolSeo["/edit-pdf"];

export const metadata: Metadata = {
  title: "Edit PDF",
  description:
    "Edit a PDF locally in your browser: add text, cover existing content, draw, and export an updated file. No uploads.",
  alternates: {
    canonical: "/edit-pdf",
  },
};

export default function EditPDFPage() {
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
      <EditPDFClient />
      <ToolSeoFooter
        title={seo.title}
        description={seo.description}
        learnMoreHref="/privacy"
        bullets={seo.bullets}
        faqs={seo.faqs}
      />
    </>
  );
}

