import { ImageResponse } from "next/og";

export const alt = "PDFKit.app – Prepare Sensitive PDFs Privately";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "radial-gradient(1200px 630px at 20% 10%, #DBEAFE 0%, #FFFFFF 55%), radial-gradient(900px 500px at 90% 100%, #EEF2FF 0%, #FFFFFF 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: -0.5,
            }}
          >
            P
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: -0.8,
            }}
          >
            PDFKit<span style={{ color: "#2563EB" }}>.app</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.05,
              fontWeight: 900,
              letterSpacing: -1.8,
              color: "#0F172A",
              maxWidth: 980,
            }}
          >
            Prepare sensitive PDFs privately
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.3, color: "#334155", maxWidth: 920 }}>
            Redact, extract, reorder, watermark, and merge PDFs locally in your browser.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {["No uploads", "No accounts", "Local processing"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: 999,
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                color: "#475569",
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
