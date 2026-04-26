import type { Metadata } from "next";
import { RemoveMetadataClient } from "./client";

export const metadata: Metadata = {
  title: "Remove Metadata",
  description: "Deep scrub a PDF by rebuilding it locally in your browser to remove document metadata.",
};

export default function RemoveMetadataPage() {
  return <RemoveMetadataClient />;
}

