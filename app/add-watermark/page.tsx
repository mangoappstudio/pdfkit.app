import type { Metadata } from "next";
import { AddWatermarkClient } from "./client";

export const metadata: Metadata = {
  title: "Add Watermark",
  description: "Add a customizable text watermark to every page of your PDF. All processing in your browser.",
};

export default function AddWatermarkPage() {
  return <AddWatermarkClient />;
}
