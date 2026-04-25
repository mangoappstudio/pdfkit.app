"use client";

import { useCallback, useRef, useState } from "react";
import { parsePageRanges } from "@/lib/pdf-utils";

export type ApplyRangeMode = "replace" | "add";

export interface ApplyRangeResult {
  ok: boolean;
  error?: string;
  indices?: number[];
}

export function usePageSelection(pageCount: number) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeInput, setRangeInput] = useState("");
  const lastClickedRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setSelected(new Set());
    setRangeInput("");
    lastClickedRef.current = null;
  }, []);

  const toggle = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const clickPage = useCallback(
    (idx: number, e: React.MouseEvent<HTMLButtonElement>) => {
      if (e.shiftKey && lastClickedRef.current !== null) {
        const start = Math.min(lastClickedRef.current, idx);
        const end = Math.max(lastClickedRef.current, idx);
        setSelected((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) next.add(i);
          return next;
        });
      } else {
        toggle(idx);
      }
      lastClickedRef.current = idx;
    },
    [toggle]
  );

  const clearAll = useCallback(() => {
    setSelected(new Set());
    lastClickedRef.current = null;
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i)));
  }, [pageCount]);

  const invertSelection = useCallback(() => {
    setSelected((prev) => {
      const next = new Set<number>();
      for (let i = 0; i < pageCount; i++) {
        if (!prev.has(i)) next.add(i);
      }
      return next;
    });
  }, [pageCount]);

  const selectOddEven = useCallback(
    (kind: "odd" | "even") => {
      const isOdd = kind === "odd";
      const next = new Set<number>();
      for (let i = 0; i < pageCount; i++) {
        const pageNumber = i + 1;
        if ((pageNumber % 2 === 1) === isOdd) next.add(i);
      }
      setSelected(next);
    },
    [pageCount]
  );

  const applyRange = useCallback(
    (mode: ApplyRangeMode, raw?: string): ApplyRangeResult => {
      const value = (raw ?? rangeInput).trim();
      if (!value) return { ok: false, error: "Please enter a page range." };
      try {
        const indices = parsePageRanges(value, pageCount);
        if (indices.length === 0) return { ok: false, error: "No pages matched that range." };
        setSelected((prev) => {
          const next = mode === "replace" ? new Set<number>() : new Set(prev);
          indices.forEach((i) => next.add(i));
          return next;
        });
        return { ok: true, indices };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid page range.";
        return { ok: false, error: msg };
      }
    },
    [rangeInput, pageCount]
  );

  return {
    selected,
    setSelected,
    rangeInput,
    setRangeInput,
    reset,
    toggle,
    clickPage,
    selectAll,
    clearAll,
    invertSelection,
    selectOddEven,
    applyRange,
  };
}

