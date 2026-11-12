import { Loader2 } from "lucide-react";

export function PageLoading({ label = "Searching…" }: { label?: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="flex items-center gap-2 text-ds-text-subtle">
        <Loader2 size={16} className="animate-spin text-ds-icon-brand" aria-hidden />
        {label}
      </p>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-ds-large border border-ds-border bg-ds-surface p-4">
          <div className="mb-3 h-4 w-1/3 animate-pulse rounded-ds-small bg-ds-skeleton" />
          <div className="mb-2 h-3 w-full animate-pulse rounded-ds-small bg-ds-skeleton" />
          <div className="h-3 w-2/3 animate-pulse rounded-ds-small bg-ds-skeleton" />
        </div>
      ))}
    </div>
  );
}
