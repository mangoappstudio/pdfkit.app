import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Check actual rendered HTML, including Next.js metadata inheritance and the
// Cloudflare export, rather than just asserting the helper's return values.
const output = process.argv[2] ?? "out";
const site = "https://www.pdfkit.app";
const routes = ["/", ...readdirSync("app", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`app/${entry.name}/page.tsx`))
  .map((entry) => `/${entry.name}`)];
const decode = (value) => value.replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"').replaceAll("&#x27;", "'")
  .replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const sitemapXml = path.join(output, "sitemap.xml");
const sitemapFile = existsSync(sitemapXml) && statSync(sitemapXml).isFile()
  ? sitemapXml : path.join(output, "sitemap.xml.body");
const sitemap = readFileSync(sitemapFile, "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.deepEqual(new Set(sitemapUrls), new Set(routes.map((route) => site + (route === "/" ? "" : route))));
assert.equal(sitemapUrls.length, routes.length, "No duplicate sitemap entries");

let apps = 0;
for (const route of routes) {
  const html = readFileSync(path.join(output, route === "/" ? "index.html" : `${route.slice(1)}.html`), "utf8");
  const tags = [...html.matchAll(/<meta\s+[^>]*>/g)].map(([tag]) => {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)]
      .map(([, key, value]) => [key, decode(value)]));
    return [attrs.property ?? attrs.name, attrs.content];
  });
  const meta = Object.fromEntries(tags);
  const title = decode(html.match(/<title>(.*?)<\/title>/)[1]);
  const canonical = decode(html.match(/<link rel="canonical" href="([^"]+)"/)[1]);
  assert.equal(canonical, site + (route === "/" ? "" : route), route);
  assert.equal(meta["og:url"], canonical, route);
  assert.equal(meta["og:title"], title, route);
  assert.equal(meta["twitter:title"], title, route);
  assert.equal(meta["og:description"], meta.description, route);
  assert.equal(meta["twitter:description"], meta.description, route);
  assert.equal(meta["og:type"], "website", route);
  assert.equal(meta["twitter:card"], "summary_large_image", route);
  for (const name of ["og:image", "twitter:image"]) {
    const image = new URL(meta[name]);
    assert.equal(image.origin, site, route);
    assert.ok(existsSync(path.join("public", image.pathname)), route);
    assert.equal(meta[`${name}:width`], "1200", route);
    assert.equal(meta[`${name}:height`], "630", route);
    assert.ok(meta[`${name}:alt`], route);
  }
  const data = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
    .flatMap(([, json]) => { const value = JSON.parse(json); return value["@graph"] ?? [value]; });
  assert.ok(data.length, route);
  assert.ok(data.every((item) => item["@type"] !== "PrivacyPolicy"), route);
  if (route === "/privacy") assert.equal(data[0]["@type"], "WebPage");
  for (const item of data.filter((item) => ["SoftwareApplication", "WebApplication"].includes(item["@type"]))) {
    apps++;
    assert.deepEqual(item.offers, { "@type": "Offer", price: 0 }, route);
    assert.equal(item.aggregateRating, undefined, "Do not fabricate ratings");
    assert.equal(item.review, undefined, "Do not fabricate reviews");
  }
}
assert.equal(apps, routes.length - 2, "Homepage and tools retain application schema");
console.log(`SEO checks passed: ${routes.length} pages, ${sitemapUrls.length} sitemap URLs, ${apps} free application offers (${output}).`);
