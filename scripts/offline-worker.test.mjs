import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('./offline-worker.js', import.meta.url), 'utf8');
const origin = 'https://pdfkit.test';
const resources = ['/', '/merge-pdf', '/_next/static/lazy.js', '/pdf.worker.min.mjs'];
function harness({ fail, putFailure = false, version = 'new', stores = new Map() } = {}) {
  const events = {}; const network = []; let claimed = false;
  const absolute = (key) => new URL(typeof key === 'string' ? key : key.url, origin).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async put(key, response) { if (putFailure) throw new Error('quota'); entries.set(absolute(key), response.clone()); },
        async match(key) { return entries.get(absolute(key))?.clone(); },
        async keys() { return [...entries.keys()].map((url) => new Request(url)); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  // Browsers resolve relative Request URLs against the worker origin.
  class LocalRequest extends Request { constructor(url, options) { super(new URL(url, origin), options); } }
  vm.runInNewContext(source, {
    VERSION: version, RESOURCES: resources, PAGES: ['/', '/merge-pdf'], URL, Set, Response,
    Request: LocalRequest, caches,
    fetch: async (request) => {
      network.push(request);
      if (new URL(request.url).pathname === fail) return new Response('failed', { status: 503 });
      return new Response('app asset', { headers: { 'Content-Type': 'application/javascript' } });
    },
    self: { location: { origin }, addEventListener: (type, fn) => { events[type] = fn; },
      clients: { async claim() { claimed = true; } } },
  });
  async function lifecycle(type) { let pending; events[type]({ waitUntil(promise) { pending = promise; } }); await pending; }
  async function status() { let result; let pending; events.message({ data: { type: 'OFFLINE_STATUS' }, ports: [{ postMessage(data) { result = data; } }], waitUntil(promise) { pending = promise; } }); await pending; return result; }
  async function fetchResource(url, options = {}) {
    let pending;
    events.fetch({ request: { url: new URL(url, origin).href, method: 'GET', mode: 'cors', headers: new Headers(), ...options }, respondWith(promise) { pending = promise; } });
    return pending ? await pending : undefined;
  }
  return { stores, caches, network, lifecycle, status, fetchResource, claimed: () => claimed };
}

test('ready only after complete installation, including unvisited lazy assets', async () => {
  const h = harness();
  assert.equal((await h.status()).ready, false);
  await h.lifecycle('install');
  assert.equal((await h.status()).ready, true);
  assert.equal(h.network.length, resources.length);
  assert.ok(h.network.every((request) => request.credentials === 'omit'));
  await h.lifecycle('activate'); assert.equal(h.claimed(), true);
  const cache = h.stores.get('pdfkit-app-new'); cache.delete(`${origin}/_next/static/lazy.js`);
  assert.equal((await h.status()).ready, false, 'eviction invalidates readiness');
});

for (const failure of [{ fail: '/_next/static/lazy.js' }, { putFailure: true }]) {
  test(`failed preparation preserves working version: ${JSON.stringify(failure)}`, async () => {
    const old = harness({ version: 'old' }); await old.lifecycle('install');
    const h = harness({ ...failure, stores: old.stores });
    await assert.rejects(h.lifecycle('install'));
    assert.ok(h.stores.has('pdfkit-app-old'));
    assert.equal(h.stores.has('pdfkit-app-new'), false);
    assert.equal((await old.status()).ready, true);
    const retry = harness({ stores: h.stores }); await retry.lifecycle('install');
    assert.equal((await retry.status()).ready, true);
    assert.ok(retry.stores.has('pdfkit-app-old'), 'install does not replace active cache');
    await retry.lifecycle('activate'); assert.equal(retry.stores.has('pdfkit-app-old'), false);
  });
}

test('cache serves offline navigations and PDF.js HEAD without persisting document requests', async () => {
  const h = harness(); await h.lifecycle('install'); const count = h.network.length;
  assert.equal(await (await h.fetchResource('/merge-pdf?filename=secret.pdf', { mode: 'navigate' })).text(), 'app asset');
  const head = await h.fetchResource('/pdf.worker.min.mjs', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal(await (await h.fetchResource('/pdf.worker.min.mjs')).text(), 'app asset');
  for (const url of ['/secret.pdf', '/_next/static/unknown.js', '/pdf.worker.min.mjs?text=secret', 'https://external.test/image.png', 'blob:https://pdfkit.test/secret']) assert.equal(await h.fetchResource(url), undefined);
  assert.equal(await h.fetchResource('/', { method: 'POST' }), undefined);
  assert.equal(h.network.length, count);
  assert.equal((await h.fetchResource('/merge-pdf', { headers: new Headers({ RSC: '1' }) })).type, 'error');
  assert.doesNotMatch(source, /self\.skipWaiting\(|location\.reload\(/);
  const keys = [...h.stores.get('pdfkit-app-new').keys()];
  assert.ok(keys.every((key) => !/secret|filename|text=/.test(key)));
});


test('storage read failure after installation preserves online access and truthful status', async () => {
  const h = harness(); await h.lifecycle('install');
  h.caches.open = async () => { throw new Error('storage unavailable'); };
  assert.equal((await h.status()).ready, false);
  assert.equal(await (await h.fetchResource('/merge-pdf', { mode: 'navigate' })).text(), 'app asset');
  assert.equal(h.network.length, resources.length + 1);
});
