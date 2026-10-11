import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { toolSeo } from "@/lib/tool-seo";

export const dynamic = "force-static";

const routes = ["/", "/about", "/privacy", ...Object.keys(toolSeo)];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: `${SITE_URL}${route === "/" ? "" : route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
