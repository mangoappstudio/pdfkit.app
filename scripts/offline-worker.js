/* global VERSION, RESOURCES, PAGES */
// Build-time constants are prepended by build-offline.mjs. No runtime writes.
const CACHE = `pdfkit-app-${VERSION}`;
const COMPLETE = new URL('/__offline_complete__', self.location.origin).href;
const allowed = new Set(RESOURCES);
const pages = new Set(PAGES);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // Bounded batches avoid a burst of hundreds of parallel downloads.
      for (let i = 0; i < RESOURCES.length; i += 8) {
        await Promise.all(RESOURCES.slice(i, i + 8).map(async (url) => {
          const response = await fetch(new Request(url, { cache: 'reload', credentials: 'omit' }));
          if (!response.ok || response.redirected || response.type === 'opaque') throw new Error('Incomplete offline setup');
          await cache.put(url, response);
        }));
      }
      await cache.put(COMPLETE, new Response(VERSION));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    // Never skipWaiting: an update must not replace an app in active use.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('pdfkit-app-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'OFFLINE_STATUS') return;
  event.waitUntil((async () => {
    let ready = false;
    try {
      const cache = await caches.open(CACHE);
      // Check entries too: eviction must not leave a stale ready indicator.
      const complete = Boolean(await cache.match(COMPLETE));
      const entries = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
      ready = complete && RESOURCES.every((url) => entries.has(url));
    } catch { /* Storage can become unavailable after installation. */ }
    event.ports[0]?.postMessage({ ready, version: VERSION });
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !['GET', 'HEAD'].includes(request.method)) return;
  // RSC payloads depend on router state. Use cached full documents instead of
  // mixing router payloads from different builds. Next falls back to navigation.
  if (request.headers.get('RSC') === '1') {
    event.respondWith(Promise.resolve(Response.error()));
    return;
  }
  const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '');
  const key = request.mode === 'navigate' && pages.has(pathname) ? pathname : url.pathname;
  if (!allowed.has(key) || (url.search && request.mode !== 'navigate')) return;
  event.respondWith((async () => {
    let cached;
    try { cached = await (await caches.open(CACHE)).match(key); }
    catch { return fetch(request); }
    if (!cached) return fetch(request); // Online app remains usable after eviction.
    if (request.method === 'HEAD') return new Response(null, { status: cached.status, headers: cached.headers });
    return cached;
  })());
});
