"use client";

import { Button } from "@/components/ui/button";

export function PreviewFeedback({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (!error) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="flex-1">{error}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Retry previews</Button>
    </div>
  );
}
