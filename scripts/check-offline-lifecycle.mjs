// Fault-injection production-browser checks. Proxy changes app resources only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const { chromium } = await import(process.env.PDFKIT_PLAYWRIGHT_MODULE || 'playwright');
const upstream = process.env.PDFKIT_BASE_URL || 'http://localhost:3104';
const original = await readFile('public/sw.js', 'utf8');
let version = 'a'; let failure = ''; let requests = 0;
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/sw.js') {
      if (failure === 'registration') { response.writeHead(404).end(); return; }
      let source = original.replace(/const VERSION = "[^"]+"/, `const VERSION = "browser-${version}"`);
      if (failure === 'quota') source = source.replace("const cache = await caches.open(CACHE);", "throw new Error('simulated quota failure'); const cache = await caches.open(CACHE);");
      response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' }).end(source); return;
    }
    if (failure === 'asset' && request.url === '/pdf.worker.min.mjs') { response.writeHead(503).end('interrupted'); return; }
    requests++;
    const result = await fetch(`${upstream}${request.url}`, { redirect: 'manual' });
    response.writeHead(result.status, { 'Content-Type': result.headers.get('content-type') || 'application/octet-stream' });
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) { response.writeHead(502).end(String(error)); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function updateWorker(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const settled = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Update did not settle')), 120000);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        const check = () => {
          if (['installed', 'redundant'].includes(worker.state)) { clearTimeout(timer); resolve(worker.state); }
        };
        worker.addEventListener('statechange', check); check();
      }, { once: true });
    });
    await registration.update();
    return settled;
  });
}
const browser = await chromium.launch({ headless: true, ...(process.env.PDFKIT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PDFKIT_CHROMIUM_EXECUTABLE } : {}) });
try {
  for (const mode of ['registration', 'asset', 'quota']) {
    failure = mode;
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto(base);
    await page.getByRole('status').filter({ hasText: /Offline setup (incomplete|unavailable)/ }).waitFor({ timeout: 120000 });
    assert.equal(await page.getByRole('status').filter({ hasText: 'Ready offline' }).count(), 0);
    failure = '';
    await page.locator('summary').filter({ hasText: 'Install & offline' }).click();
    await page.getByRole('button', { name: 'Check / retry offline setup' }).click();
    await page.getByRole('status').filter({ hasText: 'Ready offline' }).waitFor({ timeout: 120000 });
    console.log(`PASS ${mode} failure, truthful readiness and retry`);
    await context.close();
  }
  const context = await browser.newContext(); const page = await context.newPage();
  await page.goto(base);
  await page.getByRole('status').filter({ hasText: 'Ready offline' }).waitFor({ timeout: 120000 });
  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.start_url, '/');
  const cdp = await context.newCDPSession(page); await cdp.send('Page.enable');
  const installability = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(installability.installabilityErrors.filter((error) => error.errorId !== 'in-incognito'), []);
  console.log('PASS Chromium app installability criteria (test context itself is incognito)');
  await page.goto(`${base}/html-to-pdf`);
  await page.getByRole('textbox', { name: 'HTML code', exact: true }).fill('<h1>Unsaved synthetic work</h1>');
  version = 'b'; failure = 'asset';
  assert.equal(await updateWorker(page), 'redundant');
  assert.equal(await page.evaluate(async () => (await caches.keys()).includes('pdfkit-app-browser-a')), true);
  assert.equal(await page.getByRole('textbox', { name: 'HTML code', exact: true }).inputValue(), '<h1>Unsaved synthetic work</h1>');
  failure = ''; version = 'c';
  assert.equal(await updateWorker(page), 'installed');
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
  assert.equal(await page.getByRole('textbox', { name: 'HTML code', exact: true }).inputValue(), '<h1>Unsaved synthetic work</h1>');
  assert.equal(await page.evaluate(async () => (await caches.keys()).includes('pdfkit-app-browser-a')), true);
  await page.close();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const reopened = await context.newPage(); await reopened.goto(base);
  await reopened.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()).waiting);
  await reopened.getByRole('status').filter({ hasText: 'Ready offline' }).waitFor();
  await reopened.waitForFunction(async () => JSON.stringify(await caches.keys()) === JSON.stringify(['pdfkit-app-browser-c']));
  const names = await reopened.evaluate(() => caches.keys());
  assert.deepEqual(names, ['pdfkit-app-browser-c']);
  console.log('PASS manifest/Chromium installability, failed update survival, waiting update and no lost work; activation on reopen');
  await context.close();
  const profile = await mkdtemp(path.join(tmpdir(), 'pdfkit-offline-profile-'));
  const options = { headless: true, ...(process.env.PDFKIT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PDFKIT_CHROMIUM_EXECUTABLE } : {}) };
  let persistent = await chromium.launchPersistentContext(profile, options);
  const online = await persistent.newPage(); await online.goto(base);
  await online.getByRole('status').filter({ hasText: 'Ready offline' }).waitFor({ timeout: 120000 });
  const installSession = await persistent.newCDPSession(online); await installSession.send('Page.enable');
  assert.deepEqual((await installSession.send('Page.getInstallabilityErrors')).installabilityErrors, []);
  await persistent.close();
  persistent = await chromium.launchPersistentContext(profile, options);
  try {
    await persistent.setOffline(true);
    const offline = await persistent.newPage();
    const routes = JSON.parse(original.match(/const PAGES = ([^;]+);/)[1]);
    for (const route of routes) {
      await offline.goto(`${base}${route}`); await offline.locator('h1').waitFor();
      await offline.reload(); await offline.locator('h1').waitFor();
    }
    console.log('PASS persistent-profile installability and fresh browser process offline launch/reload of all 21 pages');
  } finally { await persistent.close(); }
  console.log(`PASS lifecycle checks (${requests} app resource requests)`);
} finally { await browser.close(); server.close(); }
