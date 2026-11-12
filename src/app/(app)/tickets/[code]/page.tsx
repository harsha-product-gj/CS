import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Lock, MessageSquare, Pencil, Phone, StickyNote } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canEditTicket, getStaff, getTicket } from "@/lib/tickets/queries";
import { NEEDS_OPS, SLA_FLAG_LABEL, SLA_FLAG_TONE, STATUS_TONE } from "@/lib/tickets/constants";
import { channelLabel, fmtDateTime, fmtDuration, fmtRelative, requestTime, toISTInput } from "@/lib/format";
import { customerKey } from "@/lib/orders/queries";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";
import { TicketForm } from "./ticket-form";
import { ActivityComposer } from "./activity";
import { CloseTicketButton, ConvertToComplaint } from "./ticket-actions";

const FIELD_LABEL: Record<string, string> = {
  customer_name: "name", phone: "mobile", alt_phone: "alternate mobile", email: "email", address: "address", pincode: "pincode",
  source: "source", source_detail: "source detail", category: "type", details: "details", status: "status", outcome: "closing response",
  resolution: "resolution", resolution_details: "resolution details", review_status: "review status",
  marketplace_request_id: "marketplace request ID", panel_action: "panel action", panel_comments: "panel comments",
  next_followup_at: "next follow-up", next_followup_reason: "follow-up reason", owner_id: "owner", is_closed: "closed",
};

function show(v: unknown, staff: Map<string, string>, key: string) {
  if (v == null || v === "") return "—";
  if (key === "owner_id") return staff.get(String(v)) ?? "someone";
  if (key === "next_followup_at") return fmtDateTime(String(v));
  if (typeof v === "object") return Object.entries(v as Record<string, string>).map(([k, x]) => `${k.replace(/_/g, " ")}: ${x}`).join(", ") || "—";
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-ds-text-subtle">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default async function TicketPage({ params }: PageProps<"/tickets/[code]">) {
  const user = await requireUser();
  const { code } = await params;
  const [data, staffList] = await Promise.all([getTicket(decodeURIComponent(code)), getStaff()]);
  if (!data) notFound();
  const { ticket: t, items, contacts, notes, audit, children, parentCode, previousCode } = data;
  const staff = new Map(staffList.map((s) => [s.id, s.full_name as string]));
  const canEdit = canEditTicket(user, t);
  const isAdmin = user.roles.includes("admin");
  const now = requestTime();
  const remaining = (new Date(t.deadline).getTime() - now) / 1000;

  const timeline = [
    ...contacts.map((c) => ({ at: c.at, kind: "contact" as const, by: c.by, c })),
    ...notes.map((n) => ({ at: n.at, kind: "note" as const, by: n.by, n })),
    ...audit.map((a) => ({ at: a.at, kind: "audit" as const, by: a.changed_by, a })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  const customerHref = t.phone
    ? `/customers/${encodeURIComponent(customerKey({ phone: t.phone, order_code: "", base_order_code: null }))}`
    : t.order_in_data && t.order_code
      ? `/customers/${encodeURIComponent(customerKey({ phone: null, order_code: t.order_code, base_order_code: null }))}`
      : null;

  return (
    <>
      <Link href="/tickets" className="mb-3 inline-flex items-center gap-1 text-ds-link hover:underline">
        <ChevronLeft size={16} aria-hidden /> My tickets
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={t.type === "complaint" ? "danger" : "information"}>{t.type === "complaint" ? "Complaint" : "Enquiry"}</Badge>
            <Badge tone={STATUS_TONE[t.display_status] ?? "neutral"}>{t.display_status}</Badge>
            <Badge tone={SLA_FLAG_TONE[t.sla_flag]}>{SLA_FLAG_LABEL[t.sla_flag]}</Badge>
            {t.is_closed ? <Badge>Closed</Badge> : <Badge tone="information">Open</Badge>}
            {t.policy_exception && <Badge tone="discovery">Policy exception</Badge>}
            {t.converted_at && <Badge>Converted from enquiry</Badge>}
          </div>
          <h1 className="ds-heading-large font-mono">{t.code}</h1>
          <p className="mt-1 text-ds-text-subtle">
            {t.category} · {t.source}{t.source_detail ? ` (${t.source_detail})` : ""} · {t.customer_name ?? "Unknown customer"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEdit && t.type === "enquiry" && !t.is_closed && <ConvertToComplaint id={t.id} orderCode={t.order_code} orderChannel={t.order_channel} />}
          {isAdmin && t.status === "Resolved" && !t.is_closed && <CloseTicketButton id={t.id} />}
        </div>
      </div>

      {parentCode && (
        <Card className="mb-6 bg-ds-background-information p-4 text-ds-text-information">
          Duplicate of <Link href={`/tickets/${encodeURIComponent(parentCode)}`} className="font-mono font-semibold underline">{parentCode}</Link>. Work happens on that ticket; this one closes with it.
        </Card>
      )}
      {!canEdit && !parentCode && (
        <Card className="mb-6 flex items-center gap-2 p-4 text-ds-text-subtle">
          <Lock size={16} aria-hidden /> Owned by {t.owner_name ?? "someone else"}. You can view it; ask an admin to assign it to you to make changes.
        </Card>
      )}
      {t.status === "Resolved" && !t.is_closed && t.resolution && NEEDS_OPS.includes(t.resolution) && (
        <Card className="mb-6 bg-ds-background-information p-4 text-ds-text-information">
          Resolved as <b>{t.resolution}</b>. It closes automatically once ops complete it (refund issued or replacement delivered). The Resolutions module comes next.
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {/* Remount when the ticket changes so the form never holds stale values (e.g. after logging a call). */}
          <TicketForm
            key={t.updated_at}
            canEdit={canEdit}
            isAdmin={isAdmin}
            staff={staffList.filter((s) => s.active).map((s) => ({ id: s.id, full_name: s.full_name }))}
            t={{ ...t, next_followup_at_input: toISTInput(t.next_followup_at) }}
          />

          <Card className="overflow-hidden">
            <CardHeader title="Activity" />
            {canEdit && !t.is_closed && (
              <div className="border-b border-ds-border">
                <ActivityComposer key={t.updated_at} ticketId={t.id} resolved={t.status === "Resolved"} followAt={toISTInput(t.next_followup_at)} followReason={t.next_followup_reason} />
              </div>
            )}
            <ol className="divide-y divide-ds-border">
              {timeline.map((e, i) => (
                <li key={i} className="flex gap-3 px-4 py-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ds-background-accent-gray-subtlest text-ds-icon-subtle">
                    {e.kind === "contact" ? <Phone size={14} aria-hidden /> : e.kind === "note" ? <StickyNote size={14} aria-hidden /> : <Pencil size={14} aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ds-text-subtlest">
                      <span className="font-medium text-ds-text-subtle">{(e.by && staff.get(e.by)) ?? "System"}</span> · {fmtDateTime(e.at)}
                    </p>
                    {e.kind === "contact" && (
                      <>
                        <p>
                          {e.c.direction} {e.c.mode.toLowerCase()} ·{" "}
                          <Badge tone={e.c.outcome === "Answered" ? "success" : "warning"}>{e.c.outcome}</Badge>
                        </p>
                        {e.c.note && <p className="mt-1 whitespace-pre-wrap">{e.c.note}</p>}
                      </>
                    )}
                    {e.kind === "note" && <p className="whitespace-pre-wrap">{e.n.body}</p>}
                    {e.kind === "audit" && (
                      e.a.action === "create" ? <p>Created the ticket</p>
                        : e.a.action === "convert" ? <p>Converted the enquiry to a complaint</p>
                        : e.a.action === "close" ? <p>Closed the ticket</p>
                        : (
                          <ul className="text-ds-text-subtle">
                            {Object.entries(e.a.changes ?? {}).map(([k, v]) => {
                              const ch = v as { from: unknown; to: unknown };
                              return (
                                <li key={k}>
                                  Changed {FIELD_LABEL[k] ?? k}: <span className="text-ds-text">{show(ch.from, staff, k)}</span> → <span className="text-ds-text">{show(ch.to, staff, k)}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )
                    )}
                  </div>
                </li>
              ))}
              {!timeline.length && (
                <li className="flex items-center gap-2 px-4 py-6 text-ds-text-subtle"><MessageSquare size={16} aria-hidden /> No activity yet.</li>
              )}
            </ol>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="ds-heading-xsmall mb-2">Resolution clock</h2>
            <dl className="divide-y divide-ds-border">
              <Row label="Created">{fmtDateTime(t.created_at)}</Row>
              <Row label={`Deadline (${Number(t.sla_hours)}h SLA)`}>{fmtDateTime(t.deadline)}</Row>
              {!t.resolved_at && !t.is_closed && (
                <Row label={remaining >= 0 ? "Time left" : "Overdue by"}>
                  <span className={remaining < 0 ? "font-semibold text-ds-text-danger" : ""}>{fmtDuration(Math.abs(remaining))}</span>
                </Row>
              )}
              <Row label="Customer wait">{fmtDuration(t.wait_seconds_now)}{t.pause_started_at && <span className="text-ds-text-subtlest"> (paused)</span>}</Row>
              {t.resolved_at && <Row label="Resolution TAT">{fmtDuration((new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 1000)}</Row>}
              {t.closed_at && <Row label="Closure TAT">{fmtDuration((new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 1000)}</Row>}
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="ds-heading-xsmall mb-2">Follow-up</h2>
            <dl className="divide-y divide-ds-border">
              <Row label="Next">{t.next_followup_at ? <span title={fmtDateTime(t.next_followup_at)}>{fmtRelative(t.next_followup_at, now)}</span> : <Empty />}</Row>
              <Row label="Reason">{t.next_followup_reason ?? <Empty />}</Row>
              <Row label="Calls answered">{t.contacts_answered} of {t.contacts_total}</Row>
              <Row label="Last call">{t.last_contact_outcome ?? <Empty />}</Row>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="ds-heading-xsmall mb-2">People</h2>
            <dl className="divide-y divide-ds-border">
              <Row label="Owner">{t.owner_name ?? <Empty />}</Row>
              {t.temp_owner_name && <Row label="Covering">{t.temp_owner_name}</Row>}
              <Row label="Created by">{(t.created_by && staff.get(t.created_by)) ?? <Empty />}</Row>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="ds-heading-xsmall mb-2">Order</h2>
            <dl className="divide-y divide-ds-border">
              <Row label="Order ID"><span className="font-mono text-[13px] break-all">{t.order_code ?? "No order"}</span></Row>
              <Row label="Channel">{channelLabel(t.order_channel)}</Row>
              {t.order_code && <Row label="In order data">{t.order_in_data ? "Yes" : "No (entered by agent)"}</Row>}
              {items.length > 0 && <Row label="Item(s)">{items.map((i) => i.item_name ?? i.sku).join(", ")}</Row>}
            </dl>
            {customerHref && <Link href={customerHref} className="mt-2 inline-block text-ds-link hover:underline">View customer &amp; orders</Link>}
          </Card>

          {(previousCode || children.length > 0) && (
            <Card className="p-4">
              <h2 className="ds-heading-xsmall mb-2">Related tickets</h2>
              {previousCode && (
                <p>Previous: <Link className="font-mono text-ds-link hover:underline" href={`/tickets/${encodeURIComponent(previousCode)}`}>{previousCode}</Link></p>
              )}
              {children.map((c) => (
                <p key={c.id}>Duplicate: <Link className="font-mono text-ds-link hover:underline" href={`/tickets/${encodeURIComponent(c.code)}`}>{c.code}</Link> <span className="text-ds-text-subtle">via {c.source}</span></p>
              ))}
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
