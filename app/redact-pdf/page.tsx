import type { Metadata } from "next";
import { RedactPDFClient } from "./client";
import { StructuredData } from "@/components/structured-data";
import { ToolSeoFooter } from "@/components/tool-seo-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { toolSeo } from "@/lib/tool-seo";

const seo = toolSeo["/redact-pdf"];

export const metadata: Metadata = {
  title: "Redact PDF",
  description: "Draw over sensitive information to redact it before sharing. All processing in your browser.",
  alternates: {
    canonical: "/redact-pdf",
  },
};

export default function RedactPDFPage() {
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
      <RedactPDFClient />
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
