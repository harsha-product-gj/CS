"use client";

import { useState } from "react";
import { Field, Segmented, Select } from "@/components/form";

export function CoverMode({ people, allPeople }: { people: { id: string; name: string }[]; allPeople: { id: string; name: string }[] }) {
  const [mode, setMode] = useState(people.length ? "rr" : "user");
  return (
    <div className="space-y-3">
      <Field label="Assign to" hint={mode === "rr" ? `Shared in turn among: ${people.map((p) => p.name).join(", ") || "nobody rostered today"}` : undefined}>
        <Segmented name="mode" value={mode} onChange={setMode} options={[{ value: "rr", label: "Round-robin (rostered today)" }, { value: "user", label: "One person" }]} />
      </Field>
      {mode === "user" && (
        <Select name="user" required options={allPeople.map((p) => ({ value: p.id, label: p.name }))} placeholder="Choose…" aria-label="Covering agent" />
      )}
    </div>
  );
}
