"use client";

import { startTransition, useActionState } from "react";
import { saveSla, type ActionState } from "@/lib/tickets/actions";
import { Button } from "@/components/ui";
import { FormMessage } from "@/components/form";

export function SlaForm({ rows }: { rows: { key: string; label: string; hours: number; updated: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSla, {});
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      {rows.map((r) => (
        <div key={r.key} className="flex flex-wrap items-center gap-3">
          <label htmlFor={`sla_${r.key}`} className="min-w-64 flex-1">
            {r.label}
            <span className="block text-xs text-ds-text-subtlest">Last changed {r.updated}</span>
          </label>
          <div className="flex items-center gap-2">
            <input id={`sla_${r.key}`} name={r.key} type="number" min="1" step="0.5" defaultValue={r.hours} className="ds-input w-24 text-right" />
            <span className="text-ds-text-subtle">hours</span>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 border-t border-ds-border pt-4">
        <Button type="submit" appearance="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <div className="min-w-0 flex-1"><FormMessage state={state} /></div>
      </div>
    </form>
  );
}
