"use client";

import { useEffect, useState } from "react";

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

export function OfflineAccess() {
  const [status, setStatus] = useState("Preparing offline access…");
  const [update, setUpdate] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const receivePrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const installed = () => setPrompt(null);
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

  return (
    <details className="border-t border-gray-100 text-sm text-gray-600">
      <summary className="mx-auto max-w-6xl cursor-pointer px-4 py-2 sm:px-6 focus-visible:outline-2 focus-visible:outline-blue-600">
        Install &amp; offline <span aria-hidden="true">· </span><span role="status">{status}</span>
      </summary>
      <div className="mx-auto max-w-6xl space-y-3 px-4 pb-4 sm:px-6">
        <p>All 18 tools work offline after setup. Keep this app open online until you see “Ready offline”. Your documents stay in memory and are never stored in the offline cache.</p>
        {update && <p role="status">An update is ready. Finish your work, then close all PDFKit windows and reopen to use it.</p>}
        {prompt && <button type="button" className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" onClick={async () => {
          try {
            await prompt.prompt();
            await prompt.userChoice;
          } catch {
            // Browsers may withdraw an installation prompt before it is used.
          }
          setPrompt(null);
        }}>Install PDFKit</button>}
        <p>Desktop Chrome / Edge: use the address bar install icon or menu → Install PDFKit. Android Chrome: menu → Add to home screen / Install app. iPhone / iPad Safari: Share → Add to Home Screen. If installation is unavailable, use the website normally.</p>
        <p>First setup and updates need internet. Clearing browser storage or automatic storage eviction can remove offline access. External links and remote images, fonts, or styles in imported HTML still need internet. Save your downloads before closing the app.</p>
        <button type="button" className="underline underline-offset-4 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => setAttempt((value) => value + 1)}>Check / retry offline setup</button>
      </div>
    </details>
  );
}
