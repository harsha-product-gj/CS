"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { fromISTInput } from "@/lib/format";
import { normalizePhone } from "@/lib/orders/transform";
import { canEditTicket, getSla, type TicketRow } from "./queries";
import {
  CLOSES_ON_RESOLVE, COMPLAINT_TYPES, CONTACT_DIRECTIONS, CONTACT_MODES, CONTACT_OUTCOMES, ENQUIRY_TYPES,
  FOLLOWUP_REASONS, PANEL_ACTIONS, PAUSING_REASON, POLICY_EXCEPTION_CHANNELS, RESOLUTION_FIELDS, RESOLUTIONS,
  REVIEW_APPLIES, REVIEW_STATUSES, SOCIAL_PLATFORMS, SOURCES, STATUSES, TICKET_CHANNELS, type TicketType,
} from "./constants";

export type ActionState = { error?: string; ok?: string };

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const oneOf = <T extends readonly string[]>(list: T, v: string | null) => (v && list.includes(v) ? v : null);

async function audit(by: string, ticketId: number, action: string, changes: object) {
  await db().from("audit_log").insert({ entity: "ticket", entity_id: String(ticketId), action, changed_by: by, changes });
}

function sourceDetail(f: FormData, source: string) {
  if (source === "Social media") {
    const p = oneOf(SOCIAL_PLATFORMS, str(f, "social_platform"));
    if (!p) return { error: "Pick the social media platform." };
    if (p === "Other platform") {
      const o = str(f, "source_other");
      if (!o) return { error: "Name the other platform." };
      return { value: `Other: ${o}` };
    }
    return { value: p };
  }
  if (source === "Other source") {
    const o = str(f, "source_other");
    if (!o) return { error: "Specify the other source." };
    return { value: o };
  }
  return { value: null };
}

// ---------------------------------------------------------------- pause / follow-up helpers

type Clock = Pick<TicketRow, "customer_wait_seconds" | "pause_started_at" | "pause_until">;

/** Ends any running pause, adding its time to customer wait. */
function endPause(t: Clock, now = new Date()) {
  if (!t.pause_started_at) return { customer_wait_seconds: t.customer_wait_seconds };
  const start = new Date(t.pause_started_at).getTime();
  const until = t.pause_until ? Math.min(now.getTime(), new Date(t.pause_until).getTime()) : now.getTime();
  return {
    customer_wait_seconds: t.customer_wait_seconds + Math.max(0, Math.round((until - start) / 1000)),
    pause_started_at: null,
    pause_until: null,
  };
}

function readFollowup(f: FormData) {
  const at = fromISTInput(f.get("next_followup_at"));
  const reason = oneOf(FOLLOWUP_REASONS, str(f, "next_followup_reason"));
  return { at, reason };
}

// ---------------------------------------------------------------- create

export async function createTicket(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser();
  const type = oneOf(["enquiry", "complaint"] as const, str(f, "type")) as TicketType | null;
  if (!type) return { error: "Choose Enquiry or Complaint." };

  const source = oneOf(SOURCES, str(f, "source"));
  if (!source) return { error: "Choose where the customer reached us." };
  const sd = sourceDetail(f, source);
  if (sd.error) return { error: sd.error };

  const category = oneOf(type === "enquiry" ? ENQUIRY_TYPES : COMPLAINT_TYPES, str(f, "category"));
  if (!category) return { error: `Choose the ${type} type.` };
  const details = str(f, "details");
  if (!details) return { error: type === "enquiry" ? "Describe the query." : "Describe the complaint." };

  const orderCode = str(f, "order_code");
  if (type === "complaint" && !orderCode) return { error: "A complaint needs an order ID." };
  let channel = oneOf(TICKET_CHANNELS, str(f, "order_channel"));
  if (orderCode && !channel) return { error: "Choose the order channel." };
  if (!orderCode) channel ??= "NA" as never;

  const phoneRaw = str(f, "phone");
  const phone = normalizePhone(phoneRaw);
  if (phoneRaw && !phone) return { error: "Mobile number should be a 10-digit Indian number." };
  const email = str(f, "email")?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email address looks wrong." };
  if (!phone && !email && !orderCode) return { error: "Add at least a mobile number, email or order ID." };

  const { at: followAt, reason: followReason } = readFollowup(f);
  if (!followAt || !followReason) return { error: "Set the next follow-up date, time and reason." };

  const sla = await getSla();
  const client = db();

  // Customer details come from the order data when we have them (agents can't edit them).
  let orderInData = false;
  let customer = { customer_name: str(f, "customer_name"), phone, address: str(f, "address"), pincode: str(f, "pincode") };
  const fromOrder = (o: { customer_name: string | null; phone: string | null; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; pincode: string | null }) => ({
    customer_name: o.customer_name,
    phone: o.phone ?? phone,
    address: [o.address_line1, o.address_line2, o.city, o.state].filter(Boolean).join(", ") || null,
    pincode: o.pincode,
  });
  const ORDER_CUSTOMER = "customer_name, phone, address_line1, address_line2, city, state, pincode";
  if (orderCode) {
    const { data } = await client.from("orders").select(ORDER_CUSTOMER).eq("order_code", orderCode).maybeSingle();
    orderInData = !!data;
    if (data) customer = fromOrder(data);
  } else if (phone) {
    const { data } = await client.from("orders").select(ORDER_CUSTOMER).eq("phone", phone).order("order_date", { ascending: false }).limit(1).maybeSingle();
    if (data) customer = fromOrder(data);
  }

  const parentCode = str(f, "parent_code");
  const previousCode = str(f, "previous_code");
  const refs = [parentCode, previousCode].filter(Boolean) as string[];
  const refMap = new Map<string, number>();
  if (refs.length) {
    const { data } = await client.from("tickets").select("id, code").in("code", refs);
    data?.forEach((r) => refMap.set(r.code, r.id));
  }

  const { data: code, error: codeErr } = await client.rpc("next_ticket_code", { p_type: type, p_channel: channel });
  if (codeErr || !code) return { error: `Could not create a ticket ID: ${codeErr?.message}` };

  const now = new Date().toISOString();
  const pausing = followReason === PAUSING_REASON && new Date(followAt) > new Date();
  const row = {
    code,
    type,
    order_channel: channel,
    order_code: orderCode,
    order_in_data: orderInData,
    ...customer,
    alt_phone: normalizePhone(str(f, "alt_phone")),
    email,
    source,
    source_detail: sd.value,
    category,
    details,
    status: "Open",
    marketplace_request_id: str(f, "marketplace_request_id"),
    policy_exception: POLICY_EXCEPTION_CHANNELS.includes(channel as string),
    owner_id: user.id,
    created_by: user.id,
    parent_ticket_id: parentCode ? refMap.get(parentCode) ?? null : null,
    previous_ticket_id: previousCode ? refMap.get(previousCode) ?? null : null,
    next_followup_at: followAt,
    next_followup_reason: followReason,
    sla_hours: sla[type].hours,
    pause_started_at: pausing ? now : null,
    pause_until: pausing ? followAt : null,
  };
  const { data: created, error } = await client.from("tickets").insert(row).select("id, code").single();
  if (error || !created) return { error: `Could not save the ticket: ${error?.message}` };

  const skus = f.getAll("items").map(String).filter(Boolean);
  if (skus.length) {
    const names = new Map(f.getAll("item_names").map(String).map((s) => s.split("::") as [string, string]));
    await client.from("ticket_items").insert(skus.map((sku) => ({ ticket_id: created.id, sku, item_name: names.get(sku) ?? null })));
  }
  const firstNote = str(f, "note");
  if (firstNote) await client.from("ticket_notes").insert({ ticket_id: created.id, by: user.id, body: firstNote });
  await audit(user.id, created.id, "create", { code, type, source, category });

  redirect(`/tickets/${encodeURIComponent(created.code)}`);
}

// ---------------------------------------------------------------- update (details, status, resolution, follow-up)

async function loadForEdit(user: CurrentUser, id: number) {
  const { data, error } = await db().from("ticket_view").select("*").eq("id", id).maybeSingle();
  if (error || !data) return { error: "Ticket not found." } as const;
  const t = data as TicketRow;
  if (!canEditTicket(user, t)) return { error: "You can't edit this ticket. Ask an admin for access." } as const;
  if (t.is_closed && !user.roles.includes("admin")) return { error: "This ticket is closed." } as const;
  return { t } as const;
}

async function closeChildren(parentId: number, now: string) {
  await db()
    .from("tickets")
    .update({ is_closed: true, closed_at: now, status: "Resolved", resolution: "Duplicate ticket", resolved_at: now, updated_at: now })
    .eq("parent_ticket_id", parentId)
    .eq("is_closed", false);
}

function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after)) {
    const a = JSON.stringify(before[k] ?? null);
    const b = JSON.stringify(after[k] ?? null);
    if (a !== b) out[k] = { from: before[k] ?? null, to: after[k] ?? null };
  }
  return out;
}

const AUDITED = [
  "customer_name", "phone", "alt_phone", "email", "address", "pincode", "source", "source_detail", "category", "details",
  "status", "outcome", "resolution", "resolution_details", "review_status", "marketplace_request_id", "panel_action",
  "panel_comments", "next_followup_at", "next_followup_reason", "owner_id", "is_closed",
];

export async function updateTicket(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser();
  const loaded = await loadForEdit(user, Number(f.get("id")));
  if ("error" in loaded) return { error: loaded.error };
  const t = loaded.t;
  const now = new Date();
  const nowIso = now.toISOString();

  const source = oneOf(SOURCES, str(f, "source")) ?? t.source;
  const sd = source === t.source && !f.has("social_platform") && !f.has("source_other") ? { value: t.source_detail } : sourceDetail(f, source);
  if ("error" in sd && sd.error) return { error: sd.error };

  const category = oneOf(t.type === "enquiry" ? ENQUIRY_TYPES : COMPLAINT_TYPES, str(f, "category")) ?? t.category;
  let status = oneOf(STATUSES[t.type], str(f, "status")) ?? t.status;
  // A complaint moves to In progress on its owner's first update.
  if (t.type === "complaint" && t.status === "Open" && status === "Open") status = "In progress";

  const phoneRaw = str(f, "phone");
  const phone = normalizePhone(phoneRaw);
  if (phoneRaw && !phone) return { error: "Mobile number should be a 10-digit Indian number." };
  const email = str(f, "email")?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email address looks wrong." };

  const isAdmin = user.roles.includes("admin");
  const update: Record<string, unknown> = {
    // Name, mobile and address are fixed once the ticket exists; only an admin can correct them.
    ...(isAdmin
      ? { customer_name: str(f, "customer_name"), phone, address: str(f, "address"), pincode: str(f, "pincode") }
      : {}),
    alt_phone: normalizePhone(str(f, "alt_phone")),
    email,
    source,
    source_detail: sd.value,
    category,
    details: str(f, "details") ?? t.details,
    status,
    marketplace_request_id: str(f, "marketplace_request_id"),
    panel_action: oneOf(PANEL_ACTIONS, str(f, "panel_action")),
    panel_comments: str(f, "panel_comments"),
    updated_at: nowIso,
  };
  if (update.panel_action && (update.panel_action !== t.panel_action || update.panel_comments !== t.panel_comments)) {
    update.panel_updated_at = nowIso;
  }
  if (user.roles.includes("admin")) {
    const owner = str(f, "owner_id");
    if (owner) update.owner_id = owner;
  }

  // ---- resolution
  let resolution = t.resolution;
  let resolutionDetails: Record<string, string> = t.resolution_details ?? {};
  if (status === "Resolved") {
    if (t.type === "enquiry") {
      const outcome = str(f, "outcome");
      if (!outcome) return { error: "Write the closing response given to the customer before resolving." };
      update.outcome = outcome;
    } else {
      resolution = oneOf(RESOLUTIONS, str(f, "resolution"));
      if (!resolution) return { error: "Choose a resolution before resolving." };
      resolutionDetails = {};
      for (const fld of RESOLUTION_FIELDS[resolution] ?? []) {
        const v = str(f, `rd_${fld.key}`);
        if (fld.required && !v) return { error: `${fld.label} is required for ${resolution}.` };
        if (v) resolutionDetails[fld.key] = v;
      }
      update.resolution = resolution;
      update.resolution_details = resolutionDetails;
    }
    if (t.status !== "Resolved") update.resolved_at = nowIso;
  } else if (t.status === "Resolved") {
    update.resolved_at = null; // reopened before closure
  }
  if (t.type === "complaint" && resolution && REVIEW_APPLIES.includes(resolution)) {
    update.review_status = oneOf(REVIEW_STATUSES, str(f, "review_status")) ?? t.review_status ?? "Not asked";
  }

  // ---- evidence & customer-wait clock
  Object.assign(update, endPause(t, now));
  if (status === "Awaiting evidence") {
    update.awaiting_evidence_since = t.status === "Awaiting evidence" ? t.awaiting_evidence_since : nowIso;
    // keep the clock paused while we wait for the customer
    update.pause_started_at = t.status === "Awaiting evidence" && t.pause_started_at ? t.pause_started_at : nowIso;
    update.pause_until = null;
    if (t.status === "Awaiting evidence" && t.pause_started_at) {
      update.customer_wait_seconds = t.customer_wait_seconds;
    }
  } else {
    update.awaiting_evidence_since = null;
  }

  // ---- follow-up
  if (status !== "Resolved") {
    const { at, reason } = readFollowup(f);
    if (!at || !reason) return { error: "Every open ticket needs a next follow-up date, time and reason." };
    update.next_followup_at = at;
    update.next_followup_reason = reason;
    if (status !== "Awaiting evidence" && reason === PAUSING_REASON && new Date(at) > now) {
      update.pause_started_at = nowIso;
      update.pause_until = at;
    }
  } else {
    update.next_followup_at = null;
    update.next_followup_reason = null;
  }

  // ---- closure
  const closes =
    status === "Resolved" &&
    (t.type === "enquiry" ||
      (resolution && CLOSES_ON_RESOLVE.includes(resolution)) ||
      (resolution === "Goodwill coupon" && !!resolutionDetails.coupon_code));
  if (closes && !t.is_closed) {
    update.is_closed = true;
    update.closed_at = nowIso;
  }

  const { error } = await db().from("tickets").update(update).eq("id", t.id);
  if (error) return { error: error.message };
  if (closes) await closeChildren(t.id, nowIso);

  const before = t as unknown as Record<string, unknown>;
  const changes = diff(before, Object.fromEntries(AUDITED.filter((k) => k in update).map((k) => [k, update[k]])));
  if (Object.keys(changes).length) await audit(user.id, t.id, "update", changes);

  revalidatePath(`/tickets/${t.code}`);
  return { ok: closes ? "Saved. Ticket resolved and closed." : status === "Resolved" ? "Saved. Resolved; it closes when ops complete the resolution." : "Saved." };
}

// ---------------------------------------------------------------- contact log

export async function logContact(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser();
  const loaded = await loadForEdit(user, Number(f.get("id")));
  if ("error" in loaded) return { error: loaded.error };
  const t = loaded.t;

  const direction = oneOf(CONTACT_DIRECTIONS, str(f, "direction"));
  const mode = oneOf(CONTACT_MODES, str(f, "mode"));
  const outcome = oneOf(CONTACT_OUTCOMES, str(f, "outcome"));
  if (!direction || !mode || !outcome) return { error: "Pick direction, mode and outcome." };

  const now = new Date();
  const nowIso = now.toISOString();
  const update: Record<string, unknown> = { updated_at: nowIso };
  if (t.status !== "Resolved") {
    const { at, reason } = readFollowup(f);
    if (!at || !reason) return { error: "Set the next follow-up date, time and reason." };
    update.next_followup_at = at;
    update.next_followup_reason = reason;
    if (t.status !== "Awaiting evidence") {
      Object.assign(update, endPause(t, now));
      if (reason === PAUSING_REASON && new Date(at) > now) {
        update.pause_started_at = nowIso;
        update.pause_until = at;
      }
    }
  }
  if (t.type === "complaint" && t.status === "Open") update.status = "In progress";

  const client = db();
  const { error } = await client.from("ticket_contacts").insert({
    ticket_id: t.id, by: user.id, direction, mode, outcome, note: str(f, "note"),
  });
  if (error) return { error: error.message };
  await client.from("tickets").update(update).eq("id", t.id);
  revalidatePath(`/tickets/${t.code}`);
  return { ok: "Contact logged." };
}

// ---------------------------------------------------------------- notes

export async function addNote(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser();
  const loaded = await loadForEdit(user, Number(f.get("id")));
  if ("error" in loaded) return { error: loaded.error };
  const body = str(f, "body");
  if (!body) return { error: "Write a note first." };
  const client = db();
  const { error } = await client.from("ticket_notes").insert({ ticket_id: loaded.t.id, by: user.id, body });
  if (error) return { error: error.message };
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (loaded.t.type === "complaint" && loaded.t.status === "Open") update.status = "In progress";
  await client.from("tickets").update(update).eq("id", loaded.t.id);
  revalidatePath(`/tickets/${loaded.t.code}`);
  return { ok: "Note added." };
}

// ---------------------------------------------------------------- enquiry → complaint

export async function convertToComplaint(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser();
  const loaded = await loadForEdit(user, Number(f.get("id")));
  if ("error" in loaded) return { error: loaded.error };
  const t = loaded.t;
  if (t.type !== "enquiry") return { error: "Already a complaint." };
  const category = oneOf(COMPLAINT_TYPES, str(f, "category"));
  if (!category) return { error: "Choose the complaint type." };
  const orderCode = str(f, "order_code") ?? t.order_code;
  if (!orderCode) return { error: "A complaint needs an order ID." };
  const channel = oneOf(TICKET_CHANNELS, str(f, "order_channel")) ?? (t.order_channel !== "NA" ? t.order_channel : null);
  if (!channel) return { error: "Choose the order channel." };

  const sla = await getSla();
  const update = {
    type: "complaint",
    category,
    converted_at: new Date().toISOString(),
    // deadline is measured from the original creation time with the complaint SLA
    sla_hours: sla.complaint.hours,
    status: t.status === "Resolved" ? "In progress" : t.status,
    order_code: orderCode,
    order_channel: channel,
    policy_exception: POLICY_EXCEPTION_CHANNELS.includes(channel),
    outcome: null,
    resolved_at: null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db().from("tickets").update(update).eq("id", t.id);
  if (error) return { error: error.message };
  await audit(user.id, t.id, "convert", { type: { from: "enquiry", to: "complaint" }, category: { from: t.category, to: category } });
  revalidatePath(`/tickets/${t.code}`);
  return { ok: "Converted to a complaint." };
}

// ---------------------------------------------------------------- admin: close manually (until ops modules close it)

export async function closeTicket(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser("admin");
  const id = Number(f.get("id"));
  const { data: t } = await db().from("tickets").select("id, code, status, is_closed").eq("id", id).maybeSingle();
  if (!t) return { error: "Ticket not found." };
  if (t.status !== "Resolved") return { error: "Resolve the ticket first." };
  if (t.is_closed) return { error: "Already closed." };
  const now = new Date().toISOString();
  await db().from("tickets").update({ is_closed: true, closed_at: now, updated_at: now }).eq("id", id);
  await closeChildren(id, now);
  await audit(user.id, id, "close", { is_closed: { from: false, to: true } });
  revalidatePath(`/tickets/${t.code}`);
  return { ok: "Ticket closed." };
}

// ---------------------------------------------------------------- admin: SLA settings

export async function saveSla(_: ActionState, f: FormData): Promise<ActionState> {
  const user = await requireUser("admin");
  const sla = await getSla();
  for (const key of Object.keys(sla)) {
    const v = Number(f.get(key));
    if (!Number.isFinite(v) || v <= 0 || v > 24 * 60) return { error: `${sla[key].label}: enter hours above 0.` };
    if (v !== Number(sla[key].hours)) {
      await db().from("sla_settings").update({ hours: v, updated_by: user.id, updated_at: new Date().toISOString() }).eq("key", key);
      await db().from("audit_log").insert({ entity: "sla", entity_id: key, action: "update", changed_by: user.id, changes: { hours: { from: sla[key].hours, to: v } } });
    }
  }
  revalidatePath("/admin/sla");
  return { ok: "Saved. New tickets use these; existing tickets keep the SLA they were created with." };
}
