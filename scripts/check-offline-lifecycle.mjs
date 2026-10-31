// Fault-injection production-browser checks. Proxy changes app resources only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir } from 'node:fs/promises';
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
  const artifacts = process.env.PDFKIT_OFFLINE_ARTIFACTS;
  if (artifacts) await mkdir(artifacts, { recursive: true });
  async function workerReady(page) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const ready = await page.evaluate(async () => {
        const worker = navigator.serviceWorker.controller;
        if (!worker) return false;
        return new Promise((resolve) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => { channel.port1.close(); resolve(false); }, 2000);
          channel.port1.onmessage = (event) => { clearTimeout(timer); channel.port1.close(); resolve(event.data?.ready === true); };
          worker.postMessage({ type: 'OFFLINE_STATUS' }, [channel.port2]);
        });
      });
      if (ready === true) return;
      await page.waitForTimeout(250);
    }
    throw new Error('Worker did not confirm complete offline cache');
  }
  for (const mode of ['standalone', 'ios']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    await context.addInitScript((mode) => {
      if (mode === 'ios') Object.defineProperty(navigator, 'standalone', { value: true });
      else {
        const original = window.matchMedia.bind(window);
        window.matchMedia = (query) => {
          const result = original(query);
          if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { value: true });
          return result;
        };
      }
    }, mode);
    // Hidden presentation must not bypass registration or reconnect recovery.
    failure = 'registration';
    const page = await context.newPage(); await page.goto(base);
    await page.waitForFunction(() => document.querySelector('header') && !document.querySelector('header summary'));
    await page.waitForTimeout(500);
    failure = '';
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await workerReady(page);
    for (const route of ['/', '/merge-pdf']) {
      await context.setOffline(true);
      await page.goto(`${base}${route}`); await page.reload(); await workerReady(page);
      assert.equal(await page.locator('header summary').count(), 0);
      assert.equal(await page.locator('header').evaluate((el) => el.getBoundingClientRect().height), 57);
    }
    if (artifacts && mode === 'standalone') await page.screenshot({ path: path.join(artifacts, 'installed-mobile.png') });
    await context.close();
    console.log(`PASS simulated ${mode}: hidden UI, background setup/reconnect, offline navigation/reload`);
  }
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // Exercise the no-event fallback deterministically even in installable Chromium.
    await context.addInitScript(() => window.addEventListener('beforeinstallprompt', (event) => {
      if (event.isTrusted) { event.preventDefault(); event.stopImmediatePropagation(); }
    }));
    const page = await context.newPage(); await page.goto(base); await workerReady(page);
    const summary = page.locator('header summary').filter({ hasText: 'Install app' });
    await summary.waitFor();
    assert.equal(await page.locator('header details').first().getAttribute('open'), null);
    if (artifacts) await page.screenshot({ path: path.join(artifacts, 'desktop.png') });
    await summary.focus(); await page.keyboard.press('Enter');
    await page.locator('[role="status"]').filter({ hasText: 'Ready offline' }).waitFor();
    assert.equal(await page.getByText(/Use your browser’s address bar/).isVisible(), true);
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      event.prompt = async () => { window.installPromptCalled = true; };
      event.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(event);
      window.installDefaultPrevented = event.defaultPrevented;
    });
    await page.getByRole('button', { name: 'Install PDFKit', exact: true }).click();
    assert.equal(await page.evaluate(() => window.installPromptCalled && window.installDefaultPrevented), true);
    await page.getByText(/Use your browser’s address bar/).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await summary.evaluate((el) => el === document.activeElement), true);
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 900 }); await summary.click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const panel = await page.locator('header details > div').first().boundingBox();
      assert.ok(panel.x >= 0 && panel.x + panel.width <= width, 'help stays inside viewport');
      if (artifacts) await page.screenshot({ path: path.join(artifacts, `help-${width}.png`) });
      await page.keyboard.press('Escape');
    }
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await summary.waitFor({ state: 'detached' });
    await page.reload(); await workerReady(page);
    assert.equal(await page.locator('header summary').count(), 0);
    await page.goto(`${base}/merge-pdf`); await workerReady(page);
    assert.equal(await page.locator('header summary').count(), 0);
    await context.close();
    console.log('PASS compact help, keyboard/Escape, fallback, cancelled native prompt, appinstalled across reload/navigation, desktop/mobile layout');
  }
  for (const [userAgent, guidance] of [
    ['iPhone', 'In Safari, tap Share → Add to Home Screen.'],
    ['Android', 'In Chrome, open the menu → Add to home screen / Install app.'],
  ]) {
    const context = await browser.newContext({ userAgent, serviceWorkers: 'block' });
    const page = await context.newPage(); await page.goto(base);
    await page.locator('summary').filter({ hasText: 'Install app' }).click();
    await page.getByText(guidance, { exact: true }).waitFor();
    await context.close();
  }
  console.log('PASS applicable iOS/Android browser guidance without native prompt');
  for (const mode of ['registration', 'asset', 'quota']) {
    failure = mode;
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto(base);
    await page.locator('[role="status"]').filter({ hasText: /Offline setup (incomplete|unavailable)/ }).waitFor({ state: 'attached', timeout: 120000 });
    assert.equal(await page.locator('[role="status"]').filter({ hasText: 'Ready offline' }).count(), 0);
    failure = '';
    await page.locator('summary').filter({ hasText: 'Install app' }).click();
    await page.getByRole('button', { name: 'Check / retry offline setup' }).click();
    await page.locator('[role="status"]').filter({ hasText: 'Ready offline' }).waitFor({ state: 'attached', timeout: 120000 });
    console.log(`PASS ${mode} failure, truthful readiness and retry`);
    await context.close();
  }
  const context = await browser.newContext(); const page = await context.newPage();
  await page.goto(base);
  await page.locator('[role="status"]').filter({ hasText: 'Ready offline' }).waitFor({ state: 'attached', timeout: 120000 });
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
  await reopened.locator('[role="status"]').filter({ hasText: 'Ready offline' }).waitFor({ state: 'attached' });
  await reopened.waitForFunction(async () => JSON.stringify(await caches.keys()) === JSON.stringify(['pdfkit-app-browser-c']));
  const names = await reopened.evaluate(() => caches.keys());
  assert.deepEqual(names, ['pdfkit-app-browser-c']);
  console.log('PASS manifest/Chromium installability, failed update survival, waiting update and no lost work; activation on reopen');
  await context.close();
  const profile = await mkdtemp(path.join(tmpdir(), 'pdfkit-offline-profile-'));
  const options = { headless: true, ...(process.env.PDFKIT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PDFKIT_CHROMIUM_EXECUTABLE } : {}) };
  let persistent = await chromium.launchPersistentContext(profile, options);
  const online = await persistent.newPage(); await online.goto(base);
  await online.locator('[role="status"]').filter({ hasText: 'Ready offline' }).waitFor({ state: 'attached', timeout: 120000 });
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
