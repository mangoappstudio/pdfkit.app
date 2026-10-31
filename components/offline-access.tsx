"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

async function offlineReady(worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(false); }, 10000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data?.ready === true);
    };
    try {
      worker.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      channel.port1.close();
      resolve(false);
    }
  });
}

function subscribeDisplayMode(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isInstalled() {
  let observedInstall = false;
  try { observedInstall = sessionStorage.getItem("pdfkit-installed") === "true"; } catch { /* Storage may be disabled. */ }
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true || observedInstall;
}

export function OfflineAccess() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [status, setStatus] = useState("Preparing offline access…");
  const [update, setUpdate] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [observedInstall, setInstalled] = useState(false);
  const installed = useSyncExternalStore(subscribeDisplayMode, isInstalled, () => null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const receivePrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const installed = () => {
      setPrompt(null);
      setInstalled(true);
      try { sessionStorage.setItem("pdfkit-installed", "true"); } catch { /* Detection still works without storage. */ }
    };
    window.addEventListener("beforeinstallprompt", receivePrompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", receivePrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const reconnect = () => setAttempt((value) => value + 1);
    window.addEventListener("online", reconnect);
    async function prepare() {
      if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !window.isSecureContext) {
        setStatus("Offline setup unavailable in this browser");
        return;
      }
      setStatus("Preparing offline access…");
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        if (disposed) return;
        async function check() {
          const active = navigator.serviceWorker.controller;
          const ready = active ? await offlineReady(active) : false;
          if (disposed) return;
          setUpdate(Boolean(registration.waiting));
          if (ready) setStatus("Ready offline");
          else if (registration.installing || registration.active?.state === "activating") setStatus("Preparing offline access…");
          else setStatus("Offline setup incomplete. Connect and retry.");
        }
        const watch = () => {
          const worker = registration.installing;
          if (worker) {
            worker.addEventListener("statechange", check);
            cleanups.push(() => worker.removeEventListener("statechange", check));
          }
          void check();
        };
        registration.addEventListener("updatefound", watch);
        navigator.serviceWorker.addEventListener("controllerchange", check);
        cleanups.push(() => registration.removeEventListener("updatefound", watch),
          () => navigator.serviceWorker.removeEventListener("controllerchange", check));
        watch();
        // Retry an interrupted install; a failed update leaves the active cache intact.
        await registration.update().catch(() => undefined);
        await check();
      } catch {
        if (!disposed) setStatus("Offline setup unavailable. Connect and retry.");
      }
    }
    void prepare();
    // Use complete cached pages for links, independent of Next's stateful RSC
    // prefetch format. Preserve same-page anchors and modified/new-tab clicks.
    const navigate = (event: MouseEvent) => {
      if (!navigator.serviceWorker?.controller || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element)?.closest?.("a");
      if (!anchor || anchor.download || (anchor.target && anchor.target !== "_self")) return;
      const target = new URL(anchor.href);
      if (target.origin !== location.origin || (target.pathname === location.pathname && target.search === location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      location.assign(target.href);
    };
    document.addEventListener("click", navigate, true);
    return () => {
      disposed = true;
      window.removeEventListener("online", reconnect);
      document.removeEventListener("click", navigate, true);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [attempt]);

  // Keep all offline lifecycle effects running even when installation UI is hidden.
  // Wait for client detection so installed sessions never flash an install prompt.
  if (installed !== false || observedInstall) return null;

  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const guidance = ios
    ? "In Safari, tap Share → Add to Home Screen."
    : /Android/.test(navigator.userAgent)
      ? "In Chrome, open the menu → Add to home screen / Install app."
      : "Use your browser’s address bar install icon or menu → Install PDFKit. If unavailable, keep using the website.";

  return (
    <details ref={detailsRef} className="text-sm text-gray-600" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      <summary className="cursor-pointer rounded-md px-2 py-2 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-blue-600">
        Install app
      </summary>
      <div className="absolute right-4 sm:right-6 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="font-medium text-gray-900">PDFKit, available offline</p>
        <p role="status">{status}</p>
        {update && <p role="status">An update is ready. Save your work, then close all PDFKit windows and reopen.</p>}
        {prompt ? <button type="button" className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" onClick={async () => {
          // A deferred prompt can only be used once, including after cancellation.
          setPrompt(null);
          try {
            await prompt.prompt();
            await prompt.userChoice;
          } catch {
            // Browsers may withdraw an installation prompt before it is used.
          } finally {
            detailsRef.current?.querySelector("summary")?.focus();
          }
        }}>Install PDFKit</button> : <p>{guidance}</p>}
        <button type="button" className="underline underline-offset-4 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => setAttempt((value) => value + 1)}>Check / retry offline setup</button>
        <details>
          <summary className="cursor-pointer py-1 focus-visible:outline-2 focus-visible:outline-blue-600">Offline details</summary>
          <div className="mt-2 space-y-2">
            <p>All 18 tools work offline once ready. Installation is optional. Documents stay local and are never cached.</p>
            <p>Setup and updates need internet. Clearing or evicting browser storage removes offline access. External links and remote resources in imported HTML need internet. Save downloads before closing.</p>
          </div>
        </details>
      </div>
    </details>
  );
}
