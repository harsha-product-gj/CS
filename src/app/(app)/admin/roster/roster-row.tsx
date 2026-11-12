"use client";

import { useState } from "react";

export function RosterRow({ agent, processes, selected }: { agent: { id: string; name: string }; processes: string[]; selected: string[] }) {
  const [on, setOn] = useState(selected.length > 0);
  const [procs, setProcs] = useState(new Set(selected));
  return (
    <tr className={on ? "" : "opacity-60"}>
      <td className="font-medium">{agent.name}</td>
      <td>
        <input
          type="checkbox"
          name={`on_${agent.id}`}
          checked={on}
          aria-label={`${agent.name} working`}
          onChange={(e) => setOn(e.target.checked)}
          className="h-4 w-4 accent-[var(--ds-background-brand-bold)]"
        />
      </td>
      {processes.map((p) => (
        <td key={p}>
          <input
            type="checkbox"
            name={`p_${agent.id}_${p}`}
            disabled={!on}
            checked={on && procs.has(p)}
            aria-label={p}
            onChange={(e) => {
              const next = new Set(procs);
              if (e.target.checked) next.add(p);
              else next.delete(p);
              setProcs(next);
            }}
            className="h-4 w-4 accent-[var(--ds-background-brand-bold)]"
          />
        </td>
      ))}
    </tr>
  );
}
