import type { Metadata } from "next";
import { ReorderPagesClient } from "./client";

export const metadata: Metadata = {
  title: "Reorder Pages",
  description: "Drag and drop to reorder PDF pages, rotate or delete pages. All processing in your browser.",
};

export default function ReorderPagesPage() {
  return <ReorderPagesClient />;
}
