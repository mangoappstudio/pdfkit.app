import type { Metadata } from "next";
import { AddPageNumbersClient } from "./client";

export const metadata: Metadata = {
  title: "Add Page Numbers",
  description: "Add page numbers to your PDF. All processing in your browser.",
};

export default function AddPageNumbersPage() {
  return <AddPageNumbersClient />;
}

