"use client";

import { startTransition, useActionState, useState } from "react";
import { updateTicket, type ActionState } from "@/lib/tickets/actions";
import {
  COMPLAINT_TYPES, ENQUIRY_TYPES, MARKETPLACE_CHANNELS, PANEL_ACTIONS, RESOLUTION_FIELDS, RESOLUTIONS,
  REVIEW_APPLIES, REVIEW_STATUSES, STATUSES,
} from "@/lib/tickets/constants";
import { Button, Card, CardHeader } from "@/components/ui";
import { Field, FormMessage, Select, TextArea } from "@/components/form";
import { FollowupFields, SourceFields } from "@/components/tickets/fields";

export type TicketFormData = {
  id: number;
  type: "enquiry" | "complaint";
  status: string;
  display_status: string;
  category: string;
  details: string | null;
  source: string;
  source_detail: string | null;
  customer_name: string | null;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  address: string | null;
  pincode: string | null;
  outcome: string | null;
  resolution: string | null;
  resolution_details: Record<string, string>;
  review_status: string | null;
  order_channel: string;
  marketplace_request_id: string | null;
  panel_action: string | null;
  panel_comments: string | null;
  owner_id: string | null;
  next_followup_at_input: string;
  next_followup_reason: string | null;
  is_closed: boolean;
};

export function TicketForm({ t, canEdit, isAdmin, staff }: { t: TicketFormData; canEdit: boolean; isAdmin: boolean; staff: { id: string; full_name: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateTicket, {});
  const [status, setStatus] = useState(t.status);
  const [resolution, setResolution] = useState(t.resolution ?? "");
  const resolved = status === "Resolved";
  const locked = !canEdit || (t.is_closed && !isAdmin);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="id" value={t.id} />
      <fieldset disabled={locked} className="space-y-6">
        <Card>
          <CardHeader title="Status" />
          <div className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status" htmlFor="status" hint={t.display_status === "Follow up for evidence" ? "Over 24h awaiting evidence: shown as Follow up for evidence." : undefined}>
                <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUSES[t.type]} />
              </Field>
              {isAdmin && (
                <Field label="Owner" htmlFor="owner_id">
                  <Select id="owner_id" name="owner_id" defaultValue={t.owner_id ?? ""} options={staff.map((s) => ({ value: s.id, label: s.full_name }))} />
                </Field>
              )}
            </div>

            {resolved && t.type === "enquiry" && (
              <Field label="Closing response given to the customer" htmlFor="outcome">
                <TextArea id="outcome" name="outcome" required defaultValue={t.outcome ?? ""} rows={3} />
              </Field>
            )}

            {resolved && t.type === "complaint" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Resolution" htmlFor="resolution">
                  <Select id="resolution" name="resolution" required value={resolution} onChange={(e) => setResolution(e.target.value)} options={RESOLUTIONS} placeholder="Choose…" />
                </Field>
                {(RESOLUTION_FIELDS[resolution] ?? []).map((fld) => (
                  <Field key={fld.key} label={fld.label} htmlFor={`rd_${fld.key}`}>
                    <input id={`rd_${fld.key}`} name={`rd_${fld.key}`} type={fld.type ?? "text"} step="any" required={fld.required}
                      defaultValue={t.resolution_details?.[fld.key] ?? ""} className="ds-input" />
                  </Field>
                ))}
                {REVIEW_APPLIES.includes(resolution) && (
                  <Field label="Review status" htmlFor="review_status">
                    <Select id="review_status" name="review_status" defaultValue={t.review_status ?? "Not asked"} options={REVIEW_STATUSES} />
                  </Field>
                )}
              </div>
            )}

            {!resolved && (
              <FollowupFields defaultAt={t.next_followup_at_input} defaultReason={t.next_followup_reason} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t.type === "enquiry" ? "Enquiry" : "Complaint"} />
          <div className="space-y-4 p-4">
            <SourceFields defaultSource={t.source} defaultDetail={t.source_detail} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.type === "enquiry" ? "Enquiry type" : "Complaint type"} htmlFor="category">
                <Select id="category" name="category" defaultValue={t.category} options={t.type === "enquiry" ? ENQUIRY_TYPES : COMPLAINT_TYPES} />
              </Field>
            </div>
            <Field label={t.type === "enquiry" ? "Query" : "Complaint details"} htmlFor="details">
              <TextArea id="details" name="details" defaultValue={t.details ?? ""} rows={4} />
            </Field>
          </div>
        </Card>

        {MARKETPLACE_CHANNELS.includes(t.order_channel) && (
          <Card>
            <CardHeader title="Marketplace panel" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="Request / return ID" htmlFor="marketplace_request_id">
                <input id="marketplace_request_id" name="marketplace_request_id" defaultValue={t.marketplace_request_id ?? ""} className="ds-input font-mono" />
              </Field>
              <Field label="Action taken on panel" htmlFor="panel_action">
                <Select id="panel_action" name="panel_action" defaultValue={t.panel_action ?? ""} options={PANEL_ACTIONS} placeholder="Not yet" />
              </Field>
              <Field label="Panel comments" htmlFor="panel_comments" className="sm:col-span-2">
                <input id="panel_comments" name="panel_comments" defaultValue={t.panel_comments ?? ""} className="ds-input" />
              </Field>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Customer" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="customer_name"><input id="customer_name" name="customer_name" defaultValue={t.customer_name ?? ""} className="ds-input" /></Field>
            <Field label="Mobile" htmlFor="phone"><input id="phone" name="phone" defaultValue={t.phone ?? ""} inputMode="tel" className="ds-input" /></Field>
            <Field label="Alternate mobile" htmlFor="alt_phone"><input id="alt_phone" name="alt_phone" defaultValue={t.alt_phone ?? ""} inputMode="tel" className="ds-input" /></Field>
            <Field label="Email" htmlFor="email"><input id="email" name="email" type="email" defaultValue={t.email ?? ""} className="ds-input" /></Field>
            <Field label="Address" htmlFor="address" className="sm:col-span-2"><input id="address" name="address" defaultValue={t.address ?? ""} className="ds-input" /></Field>
            <Field label="Pincode" htmlFor="pincode"><input id="pincode" name="pincode" defaultValue={t.pincode ?? ""} className="ds-input" /></Field>
          </div>
        </Card>

        {!locked && (
          <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 border-t border-ds-border bg-ds-surface-sunken px-1 py-3">
            <Button type="submit" appearance="primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            <div className="min-w-0 flex-1"><FormMessage state={state} /></div>
          </div>
        )}
      </fieldset>
    </form>
  );
}
