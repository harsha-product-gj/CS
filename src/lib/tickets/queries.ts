import "server-only";
import { db } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth";

export type TicketRow = {
  id: number;
  code: string;
  type: "enquiry" | "complaint";
  converted_at: string | null;
  order_channel: string;
  order_code: string | null;
  order_in_data: boolean;
  customer_name: string | null;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  address: string | null;
  pincode: string | null;
  source: string;
  source_detail: string | null;
  category: string;
  details: string | null;
  status: string;
  display_status: string;
  awaiting_evidence_since: string | null;
  outcome: string | null;
  resolution: string | null;
  resolution_details: Record<string, string>;
  review_status: string | null;
  marketplace_request_id: string | null;
  panel_action: string | null;
  panel_comments: string | null;
  panel_updated_at: string | null;
  policy_exception: boolean;
  owner_id: string | null;
  owner_name: string | null;
  temp_owner_id: string | null;
  temp_owner_name: string | null;
  temp_owner_from: string | null;
  temp_owner_to: string | null;
  created_by: string | null;
  parent_ticket_id: number | null;
  previous_ticket_id: number | null;
  next_followup_at: string | null;
  next_followup_reason: string | null;
  sla_hours: number;
  customer_wait_seconds: number;
  wait_seconds_now: number;
  pause_started_at: string | null;
  pause_until: string | null;
  deadline: string;
  sla_flag: "on_track" | "attention" | "delayed" | "met" | "missed";
  contacts_total: number;
  contacts_answered: number;
  last_contact_outcome: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  is_closed: boolean;
};

export type Contact = { id: number; at: string; by: string | null; direction: string; mode: string; outcome: string; note: string | null };
export type Note = { id: number; at: string; by: string | null; body: string };
export type AuditEntry = { id: number; at: string; changed_by: string | null; action: string; changes: Record<string, unknown> };

export function canEditTicket(user: CurrentUser, t: Pick<TicketRow, "owner_id" | "temp_owner_id" | "temp_owner_from" | "temp_owner_to" | "parent_ticket_id">) {
  if (user.roles.includes("admin")) return true;
  if (t.parent_ticket_id) return false; // duplicates are worked on the parent
  if (t.owner_id === user.id) return true;
  if (t.temp_owner_id === user.id) {
    const now = Date.now();
    const from = t.temp_owner_from ? new Date(t.temp_owner_from).getTime() : 0;
    const to = t.temp_owner_to ? new Date(t.temp_owner_to).getTime() : Infinity;
    return now >= from && now <= to;
  }
  return false;
}

export async function getSla() {
  const { data, error } = await db().from("sla_settings").select("key, hours, label, updated_at").order("key");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r])) as Record<string, { key: string; hours: number; label: string; updated_at: string }>;
}

export async function getStaff() {
  const { data, error } = await db().from("profiles").select("id, full_name, username, roles, active").order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function getTicket(code: string) {
  const client = db();
  const { data: t, error } = await client.from("ticket_view").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  if (!t) return null;
  const ticket = t as TicketRow;

  const [items, contacts, notes, audit, children, related] = await Promise.all([
    client.from("ticket_items").select("sku, item_name").eq("ticket_id", ticket.id),
    client.from("ticket_contacts").select("*").eq("ticket_id", ticket.id).order("at"),
    client.from("ticket_notes").select("*").eq("ticket_id", ticket.id).order("at"),
    client.from("audit_log").select("id, at, changed_by, action, changes").eq("entity", "ticket").eq("entity_id", String(ticket.id)).order("at"),
    client.from("ticket_view").select("id, code, display_status, is_closed, source, created_at").eq("parent_ticket_id", ticket.id),
    client
      .from("ticket_view")
      .select("id, code")
      .in("id", [ticket.parent_ticket_id, ticket.previous_ticket_id].filter((x): x is number => !!x).concat([-1])),
  ]);
  const byId = new Map((related.data ?? []).map((r) => [r.id, r.code as string]));

  return {
    ticket,
    items: items.data ?? [],
    contacts: (contacts.data ?? []) as Contact[],
    notes: (notes.data ?? []) as Note[],
    audit: (audit.data ?? []) as AuditEntry[],
    children: children.data ?? [],
    parentCode: ticket.parent_ticket_id ? byId.get(ticket.parent_ticket_id) ?? null : null,
    previousCode: ticket.previous_ticket_id ? byId.get(ticket.previous_ticket_id) ?? null : null,
  };
}

const LIST_COLS =
  "id, code, type, category, source, source_detail, order_code, order_channel, customer_name, phone, display_status, status, sla_flag, deadline, next_followup_at, next_followup_reason, owner_id, owner_name, temp_owner_id, temp_owner_name, contacts_total, contacts_answered, last_contact_outcome, is_closed, parent_ticket_id, created_at, updated_at, resolution";

export type TicketListRow = Pick<
  TicketRow,
  | "id" | "code" | "type" | "category" | "source" | "source_detail" | "order_code" | "order_channel" | "customer_name" | "phone"
  | "display_status" | "status" | "sla_flag" | "deadline" | "next_followup_at" | "next_followup_reason" | "owner_id" | "owner_name"
  | "temp_owner_id" | "temp_owner_name" | "contacts_total" | "contacts_answered" | "last_contact_outcome" | "is_closed"
  | "parent_ticket_id" | "created_at" | "updated_at" | "resolution"
>;

export type TicketFilter = {
  mine?: string; // user id: owner or temp owner
  view?: "due" | "attention" | "open" | "closed" | "all";
  status?: string;
  type?: string;
  source?: string;
  owner?: string;
  flag?: string;
  q?: string;
  page?: number;
};

export const PAGE_SIZE = 50;

/** End of today in IST, as ISO. */
export function endOfTodayIST() {
  const now = new Date(Date.now() + 5.5 * 3600_000);
  now.setUTCHours(23, 59, 59, 999);
  return new Date(now.getTime() - 5.5 * 3600_000).toISOString();
}

export async function listTickets(f: TicketFilter) {
  let q = db().from("ticket_view").select(LIST_COLS, { count: "exact" });
  if (f.mine) q = q.or(`owner_id.eq.${f.mine},temp_owner_id.eq.${f.mine}`);
  const view = f.view ?? "open";
  if (view === "due") q = q.eq("is_closed", false).neq("status", "Resolved").lte("next_followup_at", endOfTodayIST());
  if (view === "attention") q = q.eq("is_closed", false).in("sla_flag", ["attention", "delayed"]);
  if (view === "open") q = q.eq("is_closed", false);
  if (view === "closed") q = q.eq("is_closed", true);
  if (f.status) q = q.eq("display_status", f.status);
  if (f.type) q = q.eq("type", f.type);
  if (f.source) q = q.eq("source", f.source);
  if (f.owner) q = q.or(`owner_id.eq.${f.owner},temp_owner_id.eq.${f.owner}`);
  if (f.flag) q = q.eq("sla_flag", f.flag);
  if (f.q) {
    const s = f.q.replace(/[^\w\s@.+-]/g, "").trim();
    if (s) q = q.or(`code.ilike.%${s}%,order_code.ilike.%${s}%,phone.ilike.%${s}%,customer_name.ilike.%${s}%`);
  }
  q = view === "closed" ? q.order("updated_at", { ascending: false }) : q.order("next_followup_at", { ascending: true, nullsFirst: true });
  const page = Math.max(1, f.page ?? 1);
  q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as TicketListRow[], total: count ?? 0, page };
}

/** Counts for the My tickets tabs. */
export async function myCounts(userId: string) {
  const mine = `owner_id.eq.${userId},temp_owner_id.eq.${userId}`;
  const c = db();
  const [due, attention, open] = await Promise.all([
    c.from("ticket_view").select("id", { count: "exact", head: true }).or(mine).eq("is_closed", false).neq("status", "Resolved").lte("next_followup_at", endOfTodayIST()),
    c.from("ticket_view").select("id", { count: "exact", head: true }).or(mine).eq("is_closed", false).in("sla_flag", ["attention", "delayed"]),
    c.from("ticket_view").select("id", { count: "exact", head: true }).or(mine).eq("is_closed", false),
  ]);
  return { due: due.count ?? 0, attention: attention.count ?? 0, open: open.count ?? 0 };
}

/** Tickets for a customer (by phones and/or order codes), newest first. */
export async function ticketsForCustomer({ phones = [], orderCodes = [] }: { phones?: string[]; orderCodes?: string[] }) {
  const ors = [
    ...phones.map((p) => `phone.eq.${p}`),
    ...orderCodes.map((o) => `order_code.eq."${o.replace(/"/g, "")}"`),
  ];
  if (!ors.length) return [] as TicketListRow[];
  const { data, error } = await db().from("ticket_view").select(LIST_COLS).or(ors.join(",")).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as TicketListRow[];
}

/** Tickets matching a search box value: ticket ID, mobile, email or order ID. */
export async function searchTickets(q: string) {
  const raw = q.trim();
  if (raw.length < 3) return [] as TicketListRow[];
  const digits = raw.replace(/\D/g, "");
  const ors = [`code.ilike.${raw.replace(/[,()"]/g, "")}`, `order_code.eq."${raw.replace(/"/g, "")}"`];
  if (/^[+\d\s()-]+$/.test(raw) && digits.length >= 10) ors.push(`phone.eq.${digits.slice(-10)}`, `alt_phone.eq.${digits.slice(-10)}`);
  if (raw.includes("@")) ors.push(`email.eq.${raw.toLowerCase().replace(/[,()"]/g, "")}`);
  const { data, error } = await db().from("ticket_view").select(LIST_COLS).or(ors.join(",")).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as TicketListRow[];
}
