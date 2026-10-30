import assert from "node:assert/strict";
import { test } from "node:test";

// Regression: a failed asset check must not prevent a later preview retry.
test("worker availability checks retry failures and share successful checks", async () => {
  const { ensurePdfWorker } = await import("../lib/pdf-worker.ts");
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(null, { status: requests.length === 1 ? 503 : 200 });
  };
  try {
    await assert.rejects(ensurePdfWorker(), /worker is unavailable/);
    await Promise.all([ensurePdfWorker(), ensurePdfWorker()]);
    await ensurePdfWorker();
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], { url: "/pdf.worker.min.mjs", options: { method: "HEAD", cache: "no-store" } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
