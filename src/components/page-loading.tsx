export function PageLoading({ label = "Searching…" }: { label?: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="flex items-center gap-2 text-sm text-stone-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
        {label}
      </p>
      {[0, 1].map((i) => (
        <div key={i} className="animate-pulse rounded-lg border border-stone-200 bg-white p-4">
          <div className="mb-3 h-4 w-1/3 rounded bg-stone-200" />
          <div className="mb-2 h-3 w-full rounded bg-stone-100" />
          <div className="h-3 w-2/3 rounded bg-stone-100" />
        </div>
      ))}
    </div>
  );
}
