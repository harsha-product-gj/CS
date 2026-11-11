"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { inputCls } from "@/components/ui";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (v) router.push(`/search?q=${encodeURIComponent(v)}`);
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search mobile, order ID, AWB or name"
        className={inputCls}
        aria-label="Search"
      />
    </form>
  );
}

export function SearchBar() {
  return (
    <Suspense fallback={<input disabled className={inputCls} placeholder="Search" />}>
      <Inner />
    </Suspense>
  );
}
