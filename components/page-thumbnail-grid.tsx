"use client";

import { Check, Loader2 } from "lucide-react";

export type PageThumbnailGridVariant = "select" | "remove" | "neutral";

export interface PageThumbnailGridProps {
  pageCount: number;
  thumbnailUrls: (string | null)[];
  selectedPages?: Set<number>;
  onPageClick?: (pageIndex: number, e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: PageThumbnailGridVariant;
  isRenderingThumbnails?: boolean;
  columnsClassName?: string;
  ariaLabel?: (pageIndex: number) => string;
}

const VARIANT_STYLES: Record<PageThumbnailGridVariant, { selected: string; badge: string; overlay: string }> = {
  select: {
    selected: "border-blue-500 bg-blue-50",
    badge: "bg-blue-600",
    overlay: "bg-black/0 group-hover:bg-black/5",
  },
  remove: {
    selected: "border-red-400 bg-red-50",
    badge: "bg-red-600",
    overlay: "bg-red-500/10",
  },
  neutral: {
    selected: "border-blue-500 bg-blue-50",
    badge: "bg-blue-600",
    overlay: "bg-black/0 group-hover:bg-black/5",
  },
};

export function PageThumbnailGrid({
  pageCount,
  thumbnailUrls,
  selectedPages,
  onPageClick,
  variant = "select",
  isRenderingThumbnails = false,
  columnsClassName = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3",
  ariaLabel,
}: PageThumbnailGridProps) {
  const selected = selectedPages ?? new Set<number>();
  const styles = VARIANT_STYLES[variant];

  return (
    <div className={columnsClassName}>
      {Array.from({ length: pageCount }, (_, i) => {
        const isSelected = selected.has(i);
        const url = thumbnailUrls[i] ?? null;
        return (
          <button
            key={i}
            onClick={(e) => onPageClick?.(i, e)}
            className={`group relative aspect-[3/4] rounded-lg border-2 overflow-hidden bg-white transition-all ${
              isSelected ? styles.selected : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
            }`}
            aria-label={ariaLabel ? ariaLabel(i) : `Page ${i + 1}${isSelected ? " (selected)" : ""}`}
            aria-pressed={isSelected}
            type="button"
          >
            {url ? (
              <img
                src={url}
                alt={`Page ${i + 1} preview`}
                className={`w-full h-full object-contain bg-white ${variant === "remove" && isSelected ? "opacity-60" : ""}`}
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                {isRenderingThumbnails ? (
                  <Loader2 className="w-4 h-4 text-gray-300 animate-spin" aria-hidden="true" />
                ) : (
                  <span className="text-sm font-semibold text-gray-300">{i + 1}</span>
                )}
              </div>
            )}

            <div className={`absolute inset-0 transition-colors ${isSelected ? styles.overlay : "bg-black/0 group-hover:bg-black/5"}`} />

            <span className="absolute bottom-1 left-2 text-xs text-gray-600 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded">
              p. {i + 1}
            </span>

            {variant !== "neutral" && isSelected && (
              <span className={`absolute top-2 right-2 w-6 h-6 rounded-full ${styles.badge} text-white flex items-center justify-center shadow-sm`}>
                <Check className="w-4 h-4" aria-hidden="true" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

