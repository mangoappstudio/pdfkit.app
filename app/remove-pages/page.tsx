import type { Metadata } from "next";
import { RemovePagesClient } from "./client";

export const metadata: Metadata = {
  title: "Remove Pages",
  description: "Select pages to remove from a PDF and export the rest. All processing in your browser.",
};

export default function RemovePagesPage() {
  return <RemovePagesClient />;
}
