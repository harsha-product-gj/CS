"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

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
      className="flex w-full items-stretch overflow-hidden rounded-md border border-stone-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Mobile, order ID, AWB, name, ASIN/FSN or pincode"
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        aria-label="Search"
      />
      <button
        type="submit"
        disabled={pending || !q.trim()}
        aria-busy={pending}
        className="flex items-center gap-1.5 bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-default disabled:bg-indigo-400"
      >
        {pending ? <Spinner /> : <SearchIcon />}
        <span className="hidden sm:inline">{pending ? "Searching…" : "Search"}</span>
      </button>
    </form>
  );
}

export function SearchBar() {
  return (
    <Suspense fallback={<div className="h-[38px] w-full rounded-md border border-stone-300 bg-white" />}>
      <Inner />
    </Suspense>
  );
}
