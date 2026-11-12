"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const current = params.get("q") ?? "";
  const [q, setQ] = useState(current);
  const [pending, startTransition] = useTransition();

  // Keep the box in sync when the URL changes (back/forward, links).
  const [synced, setSynced] = useState(current);
  if (synced !== current) {
    setSynced(current);
    setQ(current);
  }

  const submit = () => {
    const v = q.trim();
    if (!v) return;
    startTransition(() => router.push(`/search?q=${encodeURIComponent(v)}`));
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex w-full items-center gap-2"
    >
      <div className="relative min-w-0 flex-1">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ds-icon-subtle" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Mobile, order ID, AWB, name, ASIN/FSN or pincode"
          className="ds-input pl-8"
          aria-label="Search customers"
        />
      </div>
      <button
        type="submit"
        disabled={pending || !q.trim()}
        aria-busy={pending}
        className="ds-focus inline-flex h-10 shrink-0 items-center gap-1.5 rounded-ds-medium bg-ds-background-brand-bold px-3 text-sm font-medium text-ds-text-inverse hover:bg-ds-background-brand-bold-hovered disabled:cursor-default disabled:bg-ds-background-disabled disabled:text-ds-text-disabled"
      >
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />}
        <span className="hidden sm:inline">{pending ? "Searching…" : "Search"}</span>
      </button>
    </form>
  );
}

export function SearchBar() {
  return (
    <Suspense fallback={<div className="h-10 w-full rounded-ds-medium border border-ds-border-input bg-ds-background-input" />}>
      <Inner />
    </Suspense>
  );
}
