"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

const BusyContext = createContext(false);
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function useToolBusy() {
  return useContext(BusyContext);
}

/** Keep the displayed inputs consistent with the document being processed. */
export function ToolWorkspace({
  busy,
  status = "Processing locally… Please wait.",
  className,
  children,
}: {
  busy: boolean;
  status?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const unavailable = busy || !ready;
  return (
    <BusyContext.Provider value={unavailable}>
      <p role="status" className={unavailable ? "mb-3 text-sm text-blue-700" : "sr-only"}>
        {!ready ? "Preparing tool…" : busy ? status : ""}
      </p>
      <fieldset disabled={unavailable} aria-busy={unavailable} aria-label="Tool controls" className={`min-w-0 ${className ?? ""}`}>
        {children}
      </fieldset>
    </BusyContext.Provider>
  );
}
