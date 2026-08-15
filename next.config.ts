import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const isCloudflarePagesBuild =
  process.env.CF_PAGES === "1" || process.env.CLOUDFLARE_PAGES === "1";

const nextConfig: NextConfig = {
  // Keep the regular Node/Vercel build available as a rollback path. Cloudflare
  // Pages receives a fully static export because all PDF processing is client-side.
  output: isCloudflarePagesBuild ? "export" : undefined,
  turbopack: {
    root: appRoot,
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
