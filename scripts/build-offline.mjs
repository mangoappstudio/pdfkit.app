// Run after Next builds: include every emitted chunk, even unvisited lazy tools.
import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export async function filesUnder(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? (await filesUnder(path.join(root, entry.name))).map((file) => `${entry.name}/${file}`)
    : [entry.name]));
  return nested.flat().sort();
}

export async function buildOffline() {
  const pages = (await filesUnder('app')).filter((file) => file === 'page.tsx' || file.endsWith('/page.tsx'))
    .map((file) => file === 'page.tsx' ? '/' : `/${file.slice(0, -9)}`);
  const assets = (await filesUnder('.next/static')).filter((file) => !file.endsWith('.map'))
    .map((file) => `/_next/static/${file}`);
  const resources = [...pages, ...assets, '/pdf.worker.min.mjs', '/manifest.webmanifest',
    '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];
  const template = await readFile('scripts/offline-worker.js', 'utf8');
  const hash = createHash('sha256').update(template).update(JSON.stringify(resources));
  // Include HTML and public resource contents so every relevant change versions the cache.
  for (const route of pages) hash.update(await readFile(`.next/server/app/${route === '/' ? 'index' : route.slice(1)}.html`));
  for (const resource of resources.filter((url) => !pages.includes(url) && !url.startsWith('/_next/'))) {
    hash.update(await readFile(resource === '/manifest.webmanifest' ? '.next/server/app/manifest.webmanifest.body' : `public${resource}`));
  }
  const worker = `const VERSION = ${JSON.stringify(hash.digest('hex').slice(0, 20))};\nconst RESOURCES = ${JSON.stringify(resources)};\nconst PAGES = ${JSON.stringify(pages)};\n${template}`;
  await writeFile('public/sw.js', worker);
  if (process.env.CLOUDFLARE_PAGES === '1' || process.env.CF_PAGES === '1') await copyFile('public/sw.js', 'out/sw.js');
  console.log(`Offline build: ${pages.length} pages, ${resources.length} permitted resources`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) await buildOffline();
