"use client";

import { useState } from "react";
import { requestEditAccess } from "@/lib/assignment/actions";
import { Button } from "@/components/ui";
import { ActionForm } from "@/components/action-form";

export function RequestAccess({ ticketId, pending }: { ticketId: number; pending: boolean }) {
  const [open, setOpen] = useState(false);
  if (pending) return <span className="text-ds-text-subtle">Edit access requested; waiting for an admin.</span>;
  if (!open) return <Button onClick={() => setOpen(true)}>Request edit access</Button>;
  return (
    <ActionForm action={requestEditAccess} submitLabel="Send request" className="mt-3 w-full">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <label htmlFor="ra_reason" className="ds-heading-xxsmall mb-1 block text-ds-text-subtle">Why do you need to edit it?</label>
      <input id="ra_reason" name="reason" required className="ds-input" placeholder="e.g. Customer called me back; owner is on another call" />
    </ActionForm>
  );
}
