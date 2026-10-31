import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const isCloudflarePagesBuild =
  process.env.CF_PAGES === "1" || process.env.CLOUDFLARE_PAGES === "1";

const nextConfig: NextConfig = {
  // Keep the regular Node build available for local production testing and
  // self-hosting. Cloudflare Pages receives a fully static export because all
  // PDF processing is client-side.
  output: isCloudflarePagesBuild ? "export" : undefined,
  ...(!isCloudflarePagesBuild ? {
    async headers() {
      return [{ source: "/sw.js", headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
      ] }];
    },
  } : {}),
  turbopack: {
    root: appRoot,
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
