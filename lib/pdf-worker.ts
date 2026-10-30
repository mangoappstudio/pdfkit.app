// Check the static asset before PDF.js can cache a failed worker initialization.
// This request contains no document data. Failed checks can be retried.
let workerCheck: Promise<void> | null = null;

export function ensurePdfWorker(): Promise<void> {
  if (!workerCheck) {
    workerCheck = fetch("/pdf.worker.min.mjs", { method: "HEAD", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("The PDF preview worker is unavailable. Please try again.");
      })
      .catch((error) => {
        workerCheck = null;
        throw error;
      });
  }
  return workerCheck;
}
