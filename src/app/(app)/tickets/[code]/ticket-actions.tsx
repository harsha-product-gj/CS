"use client";

import { startTransition, useActionState, useState } from "react";
import { closeTicket, convertToComplaint, type ActionState } from "@/lib/tickets/actions";
import { COMPLAINT_TYPES, TICKET_CHANNELS } from "@/lib/tickets/constants";
import { ORDER_CHANNELS } from "@/lib/orders/transform";
import { Button } from "@/components/ui";
import { Field, FormMessage, Select } from "@/components/form";

export function ConvertToComplaint({ id, orderCode, orderChannel }: { id: number; orderCode: string | null; orderChannel: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(convertToComplaint, {});
  if (!open) return <Button onClick={() => setOpen(true)}>Convert to complaint</Button>;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ds-blanket p-4" role="dialog" aria-modal="true" aria-labelledby="convert-title">
      <form
        className="w-full max-w-md rounded-ds-large bg-ds-surface-overlay p-5 shadow-ds-overlay"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
      >
        <h2 id="convert-title" className="ds-heading-medium mb-1">Convert to complaint</h2>
        <p className="mb-4 text-ds-text-subtle">History is kept. The deadline becomes the complaint SLA counted from when this ticket was created; the clock is not reset.</p>
        <input type="hidden" name="id" value={id} />
        <div className="space-y-3">
          <Field label="Complaint type" htmlFor="cv_category"><Select id="cv_category" name="category" required options={COMPLAINT_TYPES} placeholder="Choose…" /></Field>
          <Field label="Order ID" htmlFor="cv_order"><input id="cv_order" name="order_code" required defaultValue={orderCode ?? ""} className="ds-input font-mono" /></Field>
          <Field label="Order channel" htmlFor="cv_channel">
            <Select id="cv_channel" name="order_channel" required defaultValue={orderChannel === "NA" ? "" : orderChannel}
              options={TICKET_CHANNELS.map((c) => ({ value: c, label: ORDER_CHANNELS[c] }))} placeholder="Choose…" />
          </Field>
          <FormMessage state={state} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" appearance="subtle" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" appearance="primary" disabled={pending}>{pending ? "Converting…" : "Convert"}</Button>
        </div>
      </form>
    </div>
  );
}

export function CloseTicketButton({ id }: { id: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(closeTicket, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Close this ticket now? Use this only when the resolution is complete outside the app.")) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      {state.error && <span className="text-ds-text-danger">{state.error}</span>}
      <Button type="submit" disabled={pending}>{pending ? "Closing…" : "Close ticket"}</Button>
    </form>
  );
}
