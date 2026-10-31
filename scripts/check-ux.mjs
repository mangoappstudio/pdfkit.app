// Browser regression suite for #26. Requires an externally provisioned Playwright
// installation (or PDFKIT_PLAYWRIGHT_MODULE pointing to its ESM entrypoint).
// Start the production app first; see UX_AUDIT.md for exact commands.
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument, StandardFonts, PDFArray, PDFRawStream, PDFName, PDFDict, PDFNumber, decodePDFRawStream } from "pdf-lib";
import JSZip from "jszip";

const { chromium } = await import(process.env.PDFKIT_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PDFKIT_BASE_URL || "http://localhost:3104";
const artifacts = process.env.PDFKIT_UX_ARTIFACTS || await mkdtemp(path.join(tmpdir(), "pdfkit-ux-"));
await mkdir(artifacts, { recursive: true });
const fixture = path.join(artifacts, "sample.pdf");
const corrupt = path.join(artifacts, "corrupt.pdf");
const wrong = path.join(artifacts, "wrong.txt");
const doc = await PDFDocument.create();
doc.setTitle("Synthetic private title");
const font = await doc.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 3; i++) {
  doc.addPage([300, 400]).drawText(`Synthetic page ${i}`, { x: 30, y: 330, size: 18, font });
}
await writeFile(fixture, await doc.save());
const other = await PDFDocument.create(); other.addPage([310, 410]);
const otherFixture = path.join(artifacts, "other.pdf");
await writeFile(otherFixture, await other.save());
await writeFile(corrupt, "not a PDF"); await writeFile(wrong, "wrong file type");
const browser = await chromium.launch({ headless: true, ...(process.env.PDFKIT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PDFKIT_CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, hasTouch: true });
let page = await context.newPage(); page.setDefaultTimeout(30000);
const errors = []; const documentRequests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (["POST", "PUT", "PATCH"].includes(request.method())) documentRequests.push(request.url());
});
const routes = ["edit-pdf", "redact-pdf", "merge-pdf", "split-pdf", "reorder-pages", "extract-pages", "remove-pages", "rotate-pdf", "images-to-pdf", "pdf-to-images", "add-watermark", "add-page-numbers", "remove-metadata", "compress-pdf", "protect-pdf", "unlock-pdf", "html-to-pdf", "prepare"];
async function ready() { await page.waitForFunction(() => !document.querySelector('fieldset[aria-busy="true"]')); }
async function open(route) { await page.goto(`${base}/${route}`); await page.locator("h1").waitFor(); await page.waitForLoadState("networkidle"); await ready(); }
async function upload(file = fixture) { await page.locator('input[type="file"]').setInputFiles(file); await page.waitForTimeout(100); await ready(); }
async function screenshot(name) { await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true }); }
async function download(action) {
  let result;
  try { [result] = await Promise.all([page.waitForEvent("download"), action()]); }
  catch (error) { console.error("Download failed:", await page.locator("body").innerText()); await screenshot("failure"); throw error; }
  return { name: result.suggestedFilename(), bytes: await readFile(await result.path()) };
}
async function pdfDownload(action, count = 3) {
  const result = await download(action); const output = await PDFDocument.load(result.bytes);
  assert.equal(output.getPageCount(), count, result.name); await ready(); return { ...result, output };
}
function content(pdf, pageIndex = 0) {
  const page = pdf.getPage(pageIndex); const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => pdf.context.lookup(ref)) : [contents];
  return streams.filter((s) => s instanceof PDFRawStream).map((s) => Buffer.from(decodePDFRawStream(s).decode()).toString()).join("\n");
}
async function touchDraw() {
  const overlay = page.locator("canvas").last(); await overlay.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll("canvas")].some((c) => c.width > 100));
  // Wait for the render overlay to disappear before drawing.
  await page.waitForFunction(() => !document.querySelector("main").innerText.includes("Rendering…"));
  const rect = await overlay.boundingBox(); const cdp = await context.newCDPSession(page);
  for (const [type, touchPoints] of [
    ["touchStart", [{ x: rect.x + 40, y: rect.y + 40 }]],
    ["touchMove", [{ x: rect.x + 160, y: rect.y + 100 }]], ["touchEnd", []],
  ]) { await cdp.send("Input.dispatchTouchEvent", { type, touchPoints }); await page.waitForTimeout(80); }
  await cdp.detach();
  return { x: 40 * 300 / rect.width, y: 400 - 100 * 400 / rect.height, width: 120 * 300 / rect.width, height: 60 * 400 / rect.height };
}
let offlineCacheSnapshot;
async function cacheSnapshot() {
  return page.evaluate(async () => {
    const snapshot = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const bytes = await (await cache.match(request)).arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((n) => n.toString(16).padStart(2, '0')).join('');
        snapshot.push([request.url, hash]);
      }
    }
    return snapshot.sort(([a], [b]) => a.localeCompare(b));
  });
}
try {
  if (process.env.PDFKIT_OFFLINE === "1") {
    await page.goto(base);
    await page.getByRole("status").filter({ hasText: "Ready offline" }).waitFor({ timeout: 120000 });
    await page.locator("summary").filter({ hasText: "Install & offline" }).click();
    await page.screenshot({ path: path.join(artifacts, "offline-desktop.png") });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(artifacts, "offline-mobile.png") });
    // A fresh tab has no route or library state from the online homepage.
    offlineCacheSnapshot = await cacheSnapshot();
    await context.setOffline(true);
    const fresh = await context.newPage(); await page.close(); page = fresh;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (["POST", "PUT", "PATCH"].includes(request.method())) documentRequests.push(request.url()); });
    for (const route of ["", ...routes, "about", "privacy"]) {
      await open(route); await page.reload(); await ready();
    }
    await page.goto(base);
    await page.getByRole("link", { name: "Prepare", exact: true }).first().click();
    await page.waitForURL(`${base}/prepare`); await ready();
    assert.equal((await page.evaluate(async () => (await fetch('/pdf.worker.min.mjs', { method: 'HEAD', cache: 'no-store' })).status)), 200);
    assert.ok((await page.evaluate(async () => (await fetch('/pdf.worker.min.mjs')).text())).length > 1000);
    console.log("PASS offline fresh-tab direct loads, reloads, navigation, PDF.js HEAD/GET, mobile layout");
  }
  // Every tool: empty state, file rejection/recovery, corrupt input/recovery,
  // accessible picker, and narrow-screen overflow. Exports tested below.
  if (!["exports", "pointer"].includes(process.env.PDFKIT_UX_PHASE)) {
  for (const route of routes) {
    await open(route); await page.setViewportSize({ width: 375, height: 812 });
    if (route === "html-to-pdf") await page.getByRole("button", { name: "Upload HTML file", exact: true }).click();
    const picker = page.locator('input[type="file"]');
    await picker.setInputFiles(wrong);
    await page.getByRole("alert").filter({ hasText: "not added" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route}: empty mobile overflow`);
    if (route === "extract-pages") await screenshot("rejection-after");
    if (!["images-to-pdf", "html-to-pdf", "prepare"].includes(route)) {
      await upload(corrupt);
      if (route === "merge-pdf") {
        await page.getByText(/Cannot read PDF/).waitFor(); await screenshot("merge-after");
        assert.equal(await page.getByRole("button", { name: "Merge PDFs", exact: true }).isDisabled(), true);
        await page.getByRole("button", { name: "Remove corrupt.pdf", exact: true }).click();
      } else {
        await page.getByText(/Could not read this PDF/).last().waitFor();
      }
      await upload();
      assert.equal(await page.locator('fieldset[aria-busy="true"]').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route}: loaded mobile overflow`);
    }
    await screenshot(`${route}-mobile`);
    await page.setViewportSize({ width: 1280, height: 1000 });
    console.log(`PASS states: ${route}`);
  }
  // Hold file reads to reproduce the old remove/replace race deterministically.
  await open("extract-pages");
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    window.releaseRead = null;
    window.readGate = new Promise((resolve) => { window.releaseRead = resolve; });
    File.prototype.arrayBuffer = async function () {
      if (this.name === "delayed.pdf") await window.readGate;
      return read.call(this);
    };
  });
  await page.locator('input[type="file"]').setInputFiles({ name: "delayed.pdf", mimeType: "application/pdf", buffer: await readFile(fixture) });
  await page.locator('fieldset[aria-busy="true"]').waitFor();
  assert.equal(await page.getByRole("button", { name: "Remove", exact: true }).isDisabled(), true);
  await page.evaluate(() => window.releaseRead()); await ready();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.evaluate(() => { window.readGate = new Promise((resolve) => { window.releaseRead = resolve; }); });
  const pendingExport = page.waitForEvent("download");
  await page.getByRole("button", { name: "Extract 3 pages", exact: true }).click();
  await page.locator('fieldset[aria-busy="true"]').waitFor();
  for (const control of [page.getByRole("button", { name: "Remove", exact: true }), page.getByRole("textbox", { name: "Page range", exact: true }), page.getByRole("button", { name: "None", exact: true }), page.getByRole("button", { name: "Page 1 (selected)", exact: true })]) {
    assert.equal(await control.isDisabled(), true, "controls must stay consistent during export");
  }
  await screenshot("processing-after"); await page.evaluate(() => window.releaseRead());
  const delayedOutput = await pendingExport;
  assert.equal((await PDFDocument.load(await readFile(await delayedOutput.path()))).getPageCount(), 3);
  await ready(); await page.getByRole("button", { name: "Remove", exact: true }).click(); await upload(otherFixture);
  await page.getByText("1 page", { exact: true }).waitFor();
  console.log("PASS delayed inspection/export, disabled controls and replacement");

  // A blocked worker must yield an actionable error and recover on retry.
  await open("extract-pages");
  await page.route("**/pdf.worker.min.mjs", (route) => route.abort()); await upload();
  await page.getByText(/Page previews could not be loaded/).waitFor();
  await page.unroute("**/pdf.worker.min.mjs");
  await page.getByRole("button", { name: "Retry previews", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("main img").length === 3);
  console.log("PASS preview failure and retry");
  }
  if (process.env.PDFKIT_UX_PHASE !== "pointer") {
  await open("merge-pdf"); await upload([fixture, otherFixture]);
  await page.getByRole("textbox", { name: "Output filename", exact: true }).fill("combined.pdf");
  await page.waitForFunction(() => document.querySelectorAll("main img").length === 2);
  await page.getByText("Rendering previews…", { exact: true }).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Reorder other.pdf", exact: true }).focus();
  await page.keyboard.press("Space"); await page.waitForTimeout(300);
  await page.keyboard.press("ArrowUp"); await page.waitForTimeout(300); await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  const merged = await pdfDownload(() => page.getByRole("button", { name: "Merge PDFs", exact: true }).click(), 4);
  assert.equal(merged.name, "combined.pdf"); assert.equal(merged.output.getPage(0).getWidth(), 310);
  await pdfDownload(() => page.getByRole("button", { name: "Merge PDFs", exact: true }).click(), 4);
  console.log("PASS merge: keyboard order, filename, repeated export");
  await open("extract-pages"); await upload(); await page.getByRole("textbox", { name: "Page range", exact: true }).fill("1abc");
  await page.getByRole("button", { name: "Select range", exact: true }).click();
  await page.getByText(/Invalid page range/).waitFor();
  await page.getByRole("textbox", { name: "Page range", exact: true }).fill("1,3");
  await page.getByRole("button", { name: "Select range", exact: true }).click();
  await pdfDownload(() => page.getByRole("button", { name: "Extract 2 pages", exact: true }).click(), 2);
  await open("remove-pages"); await upload(); await page.getByRole("button", { name: "Page 2", exact: true }).click();
  await pdfDownload(() => page.getByRole("button", { name: "Export without 1 page", exact: true }).click(), 2);
  await open("rotate-pdf"); await upload(); await page.getByLabel("Direction", { exact: true }).selectOption("counterclockwise");
  const rotated = await pdfDownload(() => page.getByRole("button", { name: "Rotate and download", exact: true }).click());
  assert.deepEqual(rotated.output.getPages().map((p) => p.getRotation().angle), [270, 270, 270]);
  console.log("PASS page extraction/removal/rotation");
  await open("reorder-pages"); await upload();
  await page.getByRole("button", { name: "Rotate page 1", exact: true }).click();
  for (let i = 1; i <= 3; i++) await page.getByRole("button", { name: `Delete page ${i}`, exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Delete page 3", exact: true }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "Delete page 2", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click(); await page.getByRole("button", { name: "Undo", exact: true }).click();
  const reordered = await pdfDownload(() => page.getByRole("button", { name: "Export PDF", exact: true }).click());
  assert.equal(reordered.output.getPage(0).getRotation().angle, 90); await screenshot("reorder-after");
  console.log("PASS reorder: rotation, delete-all recovery, one undo per action");
  await open("split-pdf"); await upload(); await page.getByLabel(/Page ranges/).fill(";;");
  await page.getByRole("button", { name: "Split PDF", exact: true }).click();
  await page.getByText(/Invalid page range: empty entry/).waitFor();
  await page.getByLabel(/Page ranges/).fill("1-2;3");
  await page.getByRole("button", { name: "Split PDF", exact: true }).click();
  await pdfDownload(() => page.getByRole("button", { name: "Download", exact: true }).first().click(), 2);
  const parts = await download(() => page.getByRole("button", { name: "Download all (.zip)", exact: true }).click());
  assert.equal(Object.keys((await JSZip.loadAsync(parts.bytes)).files).length, 2);
  await open("pdf-to-images"); await upload();
  await page.getByRole("button", { name: "Page 1 (selected)", exact: true }).click();
  const images = await download(() => page.getByRole("button", { name: "Export 2 pages to zip", exact: true }).click());
  assert.deepEqual(Object.keys((await JSZip.loadAsync(images.bytes)).files).sort(), ["page-2.png", "page-3.png"]);
  for (const entry of Object.values((await JSZip.loadAsync(images.bytes)).files)) {
    const bytes = await entry.async('nodebuffer');
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0);
  }
  console.log("PASS split and PDF-to-images ZIP exports");
  await open("add-watermark"); await upload();
  const watermarked = await pdfDownload(() => page.getByRole("button", { name: "Apply Watermark", exact: true }).click());
  assert.match(content(watermarked.output), /434F4E464944454E5449414C/i);
  await open("add-page-numbers"); await upload();
  const numbered = await pdfDownload(() => page.getByRole("button", { name: "Add page numbers", exact: true }).click());
  assert.notEqual(content(numbered.output), content(doc));
  await open("remove-metadata"); await upload();
  const scrubbed = await pdfDownload(() => page.getByRole("button", { name: /Scrub/ }).click());
  assert.equal(scrubbed.output.getTitle(), undefined);
  await open("compress-pdf"); await upload(); await pdfDownload(() => page.getByRole("button", { name: /Compress & download/ }).click());
  console.log("PASS watermark/page-numbers/metadata/compression");
  const pngPath = path.join(artifacts, "sample.png");
  await writeFile(pngPath, Buffer.from(await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 20; c.height = 30; const ctx = c.getContext("2d"); ctx.fillStyle = "red"; ctx.fillRect(0, 0, 20, 30); return c.toDataURL("image/png").split(",")[1]; }), "base64"));
  await open("images-to-pdf"); await upload(pngPath); await page.getByLabel("Output filename", { exact: true }).fill("pictures.pdf");
  const pictures = await pdfDownload(() => page.getByRole("button", { name: "Convert to PDF", exact: true }).click(), 1); assert.equal(pictures.name, "pictures.pdf");
  await open("html-to-pdf"); await page.getByRole("textbox", { name: "HTML code", exact: true }).fill('<h1 style="color: black">Synthetic HTML</h1>');
  for (let attempt = 0; attempt < 3; attempt++) {
    await pdfDownload(() => page.getByRole("button", { name: "Convert to PDF", exact: true }).click(), 1);
  }
  await open("prepare"); await upload([fixture, pngPath]); await page.getByRole("button", { name: "Next: Organize →", exact: true }).click();
  await page.getByRole("button", { name: "Next: Export options →", exact: true }).click();
  await pdfDownload(() => page.getByRole("button", { name: "Export packet", exact: true }).click(), 4);
  console.log("PASS image/HTML/packet exports");
  await open("protect-pdf"); await upload();
  await page.getByLabel("Password (required)", { exact: true }).fill("synthetic-password"); await page.getByLabel("Confirm password", { exact: true }).fill("mismatch");
  assert.equal(await page.getByRole("button", { name: "Protect and download", exact: true }).isDisabled(), true);
  await page.getByLabel("Confirm password", { exact: true }).fill("synthetic-password");
  await page.getByLabel(/Owner password/).fill("synthetic-owner-password");
  const protectedFile = await download(() => page.getByRole("button", { name: "Protect and download", exact: true }).click());
  const protectedPath = path.join(artifacts, "protected.pdf"); await writeFile(protectedPath, protectedFile.bytes);
  await open("unlock-pdf"); await upload(protectedPath); await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Unlock and download", exact: true }).click(); await page.getByText("Incorrect password for this PDF.", { exact: true }).waitFor(); await ready();
  await page.getByLabel("Password", { exact: true }).fill("synthetic-owner-password");
  const unlocked = await pdfDownload(() => page.getByRole("button", { name: "Unlock and download", exact: true }).click());
  assert.match(content(unlocked.output), /53796e74686574696320706167652031/i);
  await open("protect-pdf"); await upload(protectedPath);
  await page.getByLabel("Current password", { exact: true }).fill("wrong");
  await page.getByLabel("Password (required)", { exact: true }).fill("replacement-password");
  await page.getByLabel("Confirm password", { exact: true }).fill("replacement-password");
  await page.getByRole("button", { name: "Protect and download", exact: true }).click();
  await page.getByText("Incorrect password for this PDF.", { exact: true }).waitFor(); await ready();
  await page.getByLabel("Current password", { exact: true }).fill("synthetic-owner-password");
  await download(() => page.getByRole("button", { name: "Protect and download", exact: true }).click());
  console.log("PASS protection: mismatch, wrong password recovery, protect/unlock round trip");
  }
  for (const route of ["edit-pdf", "redact-pdf"]) {
    await open(route); await upload();
    if (route === "edit-pdf") await page.getByRole("button", { name: "Whiteout", exact: true }).click();
    await page.getByRole("slider", { name: "Zoom", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => !document.querySelector("main").innerText.includes("Rendering…"));
    const drawn = await touchDraw();
    if (route === "edit-pdf") {
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "Delete", exact: true }).isDisabled(), true);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
    }
    await screenshot(`${route}-touch-after`);
    const edited = await pdfDownload(() => page.getByRole("button", { name: route === "edit-pdf" ? "Export edited PDF" : "Export flattened redaction", exact: true }).click());
    assert.notEqual(content(edited.output), content(doc));
    if (route === "edit-pdf") {
      const translations = [...content(edited.output).matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) cm/g)];
      assert.ok(translations.some((m) => Math.abs(Number(m[1]) - drawn.x) < 0.6 && Math.abs(Number(m[2]) - drawn.y) < 0.6), "whiteout export coordinates match zoomed gesture");
    } else {
      assert.doesNotMatch(content(edited.output), /Synthetic|53796e746865746963|\bTj\b|\bTJ\b/i);
      const objects = edited.output.getPage(0).node.Resources().lookup(PDFName.of("XObject"), PDFDict);
      const image = objects.entries().map(([, ref]) => edited.output.context.lookup(ref)).find((obj) => obj instanceof PDFRawStream);
      const width = image.dict.lookup(PDFName.of("Width"), PDFNumber).asNumber();
      const height = image.dict.lookup(PDFName.of("Height"), PDFNumber).asNumber();
      const pixels = decodePDFRawStream(image).decode();
      const x = Math.round((drawn.x + drawn.width / 2) / 300 * width);
      const y = Math.round((400 - drawn.y - drawn.height / 2) / 400 * height);
      const pixel = pixels.slice((y * width + x) * 3, (y * width + x) * 3 + 3);
      assert.ok(pixel[0] + pixel[1] + pixel[2] < 60, "flattened export black box matches gesture coordinates");
    }
    // Mouse capture must complete a second gesture even after leaving the canvas.
    const overlay = page.locator("canvas").last(); await overlay.scrollIntoViewIfNeeded(); const bounds = await overlay.boundingBox();
    await page.mouse.move(bounds.x + 180, bounds.y + 180); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width + 20, bounds.y + bounds.height + 20, { steps: 4 }); await page.mouse.up();
    const cdp = await context.newCDPSession(page);
    for (const [type, touchPoints] of [["touchStart", [{ x: bounds.x + 10, y: bounds.y + 120 }]], ["touchMove", [{ x: bounds.x + 70, y: bounds.y + 160 }]], ["touchCancel", []]]) {
      await cdp.send("Input.dispatchTouchEvent", { type, touchPoints }); await page.waitForTimeout(80);
    }
    await cdp.detach();
    const mouseOutput = await pdfDownload(() => page.getByRole("button", { name: route === "edit-pdf" ? "Export edited PDF" : "Export flattened redaction", exact: true }).click());
    if (route === "edit-pdf") assert.equal((content(mouseOutput.output).match(/1 1 1 rg/g) || []).length, 2, "cancelled gesture adds no whiteout");
    else await page.getByText("3 pages · 2 redactions applied", { exact: true }).waitFor();
    console.log(`PASS zoomed touch/mouse/cancellation and export: ${route}`);
  }
  if (process.env.PDFKIT_OFFLINE === "1") {
    const keys = await page.evaluate(async () => {
      const names = await caches.keys();
      return (await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url)))).flat();
    });
    assert.ok(keys.length > 30);
    assert.ok(keys.every((url) => !/sample|synthetic|protected|blob:|password|filename|\?/.test(url)), "no document data in cache");
    assert.deepEqual(await cacheSnapshot(), offlineCacheSnapshot, "processing never changes cached app resources");
    console.log(`PASS cache privacy: ${keys.length} app-only entries`);
  }
  assert.deepEqual(errors, [], "uncaught browser errors"); assert.deepEqual(documentRequests, [], "document processing made a network write");
  console.log(`PASS ${process.env.PDFKIT_UX_PHASE ? `${process.env.PDFKIT_UX_PHASE} checks` : "all 18 tools"}. Artifacts: ${artifacts}`);
} catch (error) {
  console.error("Failed at", page.url(), "Browser errors:", errors);
  await screenshot("failure");
  throw error;
} finally { await browser.close(); }
