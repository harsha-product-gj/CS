"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function DecisionButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-ds-text-subtle">
        Access for
        <select name="hours" defaultValue="4" className="ds-input h-8 w-auto">
          {[1, 2, 4, 8, 24, 48].map((h) => <option key={h} value={h}>{h}h</option>)}
        </select>
      </label>
      <Button type="submit" name="decision" value="approve" appearance="primary" disabled={pending}>Approve</Button>
      <Button type="submit" name="decision" value="reject" appearance="subtle" disabled={pending}>Reject</Button>
    </div>
  );
}
