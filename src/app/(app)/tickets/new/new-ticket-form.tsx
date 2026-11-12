"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createTicket, type ActionState } from "@/lib/tickets/actions";
import { COMPLAINT_TYPES, ENQUIRY_TYPES, MARKETPLACE_CHANNELS, POLICY_EXCEPTION_CHANNELS, TICKET_CHANNELS } from "@/lib/tickets/constants";
import { ORDER_CHANNELS } from "@/lib/orders/transform";
import { Button, Card, CardHeader } from "@/components/ui";
import { Field, FormMessage, Segmented, Select, TextArea } from "@/components/form";
import { FollowupFields, SourceFields } from "@/components/tickets/fields";
import { fmtDateTime } from "@/lib/format";

export type NewTicketPrefill = {
  orderCode?: string;
  orderChannel?: string;
  orderInData?: boolean;
  /** Customer found in our order data: name, mobile and address come from there and can't be edited. */
  customerLocked?: boolean;
  orderDate?: string | null;
  customerName?: string;
  phone?: string;
  address?: string;
  pincode?: string;
  items: { sku: string; name: string }[];
};

const CHANNEL_OPTIONS = TICKET_CHANNELS.map((c) => ({ value: c, label: ORDER_CHANNELS[c] }));

export function NewTicketForm({
  prefill,
  openTickets,
  closedTickets,
}: {
  prefill: NewTicketPrefill;
  openTickets: { code: string; status: string; owner: string | null; source: string; category: string }[];
  closedTickets: { code: string; category: string; resolution: string | null }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTicket, {});
  const [type, setType] = useState<"enquiry" | "complaint">("complaint");
  const [channel, setChannel] = useState(prefill.orderChannel ?? "");
  const [asDuplicate, setAsDuplicate] = useState(false);

  return (
    <form
      // Submit without React's automatic form reset, so a validation error keeps what the agent typed.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="grid gap-6 xl:grid-cols-[1fr_320px]"
    >
      <div className="min-w-0 space-y-6">
        {openTickets.length > 0 && (
          <Card className="border-ds-border-warning bg-ds-background-warning p-4">
            <div className="flex gap-3">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-ds-icon-warning" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ds-text-warning">This customer already has an open ticket</p>
                <p className="mb-2 text-ds-text">Share its latest status and tell them the owner will call back. Don’t create a new one unless it’s a different issue.</p>
                <ul className="mb-3 space-y-1">
                  {openTickets.map((t) => (
                    <li key={t.code}>
                      <Link href={`/tickets/${encodeURIComponent(t.code)}`} className="font-mono text-[13px] text-ds-link hover:underline">{t.code}</Link>
                      <span className="text-ds-text-subtle"> · {t.category} · {t.status} · {t.owner ?? "Unassigned"} · via {t.source}</span>
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={asDuplicate} onChange={(e) => setAsDuplicate(e.target.checked)} />
                  Log this contact as a duplicate linked to
                  <select name={asDuplicate ? "parent_code" : undefined} className="ds-input h-8 w-auto" disabled={!asDuplicate}>
                    {openTickets.map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Ticket" />
          <div className="space-y-4 p-4">
            <Field label="Type">
              <Segmented name="type" value={type} onChange={(v) => setType(v as "enquiry" | "complaint")} options={[{ value: "complaint", label: "Complaint" }, { value: "enquiry", label: "Enquiry" }]} />
            </Field>
            <SourceFields />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={type === "enquiry" ? "Enquiry type" : "Complaint type"} htmlFor="category">
                <Select key={type} id="category" name="category" required options={type === "enquiry" ? ENQUIRY_TYPES : COMPLAINT_TYPES} placeholder="Choose…" />
              </Field>
            </div>
            <Field label={type === "enquiry" ? "Query" : "Complaint details"} htmlFor="details">
              <TextArea id="details" name="details" required rows={4} placeholder={type === "enquiry" ? "What does the customer want to know?" : "What went wrong, in the customer’s words"} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Order" />
          <div className="space-y-4 p-4">
            {prefill.orderInData ? (
              <>
                <input type="hidden" name="order_code" value={prefill.orderCode} />
                <input type="hidden" name="order_channel" value={channel} />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-mono text-[13px] font-semibold">{prefill.orderCode}</span>
                  <span className="text-ds-text-subtle">{ORDER_CHANNELS[channel as keyof typeof ORDER_CHANNELS] ?? channel}</span>
                  <span className="text-ds-text-subtle">{fmtDateTime(prefill.orderDate)}</span>
                </div>
                {!channel && (
                  <Field label="Order channel" htmlFor="order_channel_pick">
                    <Select id="order_channel_pick" value={channel} onChange={(e) => setChannel(e.target.value)} options={CHANNEL_OPTIONS} placeholder="Choose…" required />
                  </Field>
                )}
                {prefill.items.length > 0 && (
                  <Field label="Affected item(s)">
                    <div className="space-y-1.5">
                      {prefill.items.map((i) => (
                        <label key={i.sku} className="flex items-center gap-2">
                          <input type="checkbox" name="items" value={i.sku} defaultChecked={prefill.items.length === 1} />
                          <input type="hidden" name="item_names" value={`${i.sku}::${i.name}`} />
                          {i.name} <span className="font-mono text-xs text-ds-text-subtlest">{i.sku}</span>
                        </label>
                      ))}
                    </div>
                  </Field>
                )}
              </>
            ) : (
              <>
                <p className="text-ds-text-subtle">
                  {prefill.orderCode ? "This order isn’t in the order data. " : ""}
                  Enter the order details from the customer. FBA, FBF and RetailEZ orders are usually not in our data.
                  {type === "enquiry" && " Enquiries can be logged without an order."}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={type === "complaint" ? "Order ID" : "Order ID (optional)"} htmlFor="order_code">
                    <input id="order_code" name="order_code" defaultValue={prefill.orderCode} required={type === "complaint"} className="ds-input font-mono" />
                  </Field>
                  <Field label="Order channel" htmlFor="order_channel">
                    <Select id="order_channel" name="order_channel" value={channel} onChange={(e) => setChannel(e.target.value)} options={CHANNEL_OPTIONS} placeholder="Choose…" required={type === "complaint"} />
                  </Field>
                  <Field label="Affected item / SKU (as the customer says)" htmlFor="items" className="sm:col-span-2">
                    <input id="items" name="items" className="ds-input" placeholder="e.g. Ortho SpineX, Queen" />
                  </Field>
                </div>
                <p className="text-xs text-ds-text-subtlest">Ask the customer for the invoice. Uploading invoices and evidence comes in the next step of this module.</p>
              </>
            )}
            {POLICY_EXCEPTION_CHANNELS.includes(channel) && (
              <p className="rounded-ds-medium bg-ds-background-discovery px-3 py-2 text-ds-text-discovery">
                Policy exception: this channel can’t be handled on the marketplace panel, so it’s resolved offline as goodwill.
              </p>
            )}
            {MARKETPLACE_CHANNELS.includes(channel) && !POLICY_EXCEPTION_CHANNELS.includes(channel) && (
              <Field label="Marketplace request / return ID (if any)" htmlFor="marketplace_request_id">
                <input id="marketplace_request_id" name="marketplace_request_id" className="ds-input font-mono" />
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Customer" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {prefill.customerLocked ? (
              <>
                <input type="hidden" name="phone" value={prefill.phone ?? ""} />
                <dl className="grid gap-x-6 gap-y-2 sm:col-span-2 sm:grid-cols-2">
                  <div><dt className="ds-heading-xxsmall text-ds-text-subtle">Name</dt><dd>{prefill.customerName || "—"}</dd></div>
                  <div><dt className="ds-heading-xxsmall text-ds-text-subtle">Mobile</dt><dd className="font-mono text-[13px]">{prefill.phone ? `+91 ${prefill.phone}` : "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="ds-heading-xxsmall text-ds-text-subtle">Address</dt><dd>{[prefill.address, prefill.pincode].filter(Boolean).join(", ") || "—"}</dd></div>
                </dl>
                <p className="text-xs text-ds-text-subtlest sm:col-span-2">From the order data; these can’t be changed here.</p>
              </>
            ) : (
              <>
                <Field label="Name" htmlFor="customer_name"><input id="customer_name" name="customer_name" defaultValue={prefill.customerName} className="ds-input" /></Field>
                <Field label="Mobile" htmlFor="phone"><input id="phone" name="phone" defaultValue={prefill.phone} inputMode="tel" className="ds-input" placeholder="10-digit mobile" /></Field>
                <Field label="Address" htmlFor="address" className="sm:col-span-2"><input id="address" name="address" defaultValue={prefill.address} className="ds-input" /></Field>
                <Field label="Pincode" htmlFor="pincode"><input id="pincode" name="pincode" defaultValue={prefill.pincode} inputMode="numeric" className="ds-input" /></Field>
              </>
            )}
            <Field label="Alternate mobile" htmlFor="alt_phone"
              hint="If the customer is calling from another number, add it only after validating the invoice / order details.">
              <input id="alt_phone" name="alt_phone" inputMode="tel" className="ds-input" />
            </Field>
            <Field label="Email" htmlFor="email"><input id="email" name="email" type="email" className="ds-input" /></Field>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Next follow-up" />
          <div className="p-4">
            <FollowupFields />
          </div>
        </Card>
        {closedTickets.length > 0 && (
          <Card>
            <CardHeader title="Previous ticket" />
            <div className="p-4">
              <Field label="Refers to a closed ticket" htmlFor="previous_code" hint="Closed tickets can’t be reopened; link the old one instead.">
                <Select id="previous_code" name="previous_code" options={closedTickets.map((t) => ({ value: t.code, label: `${t.code} · ${t.category}` }))} placeholder="None" />
              </Field>
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="First note" />
          <div className="p-4">
            <TextArea name="note" rows={3} placeholder="What was discussed on this call (optional)" />
          </div>
        </Card>
        <div className="space-y-3">
          <FormMessage state={state} />
          <Button type="submit" appearance="primary" disabled={pending} className="h-10 w-full">
            {pending ? "Creating…" : "Create ticket"}
          </Button>
        </div>
      </div>
    </form>
  );
}
