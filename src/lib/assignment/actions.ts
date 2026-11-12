"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { fromISTInput } from "@/lib/format";
import { normalizePhone } from "@/lib/orders/transform";
import { getSla } from "@/lib/tickets/queries";
import { agentsOnDuty, getAgents, getProcesses, isDay, istToday, roundRobin } from "./queries";

export type AState = { error?: string; ok?: string; details?: string[] };

async function audit(by: string, entity: string, entityId: string, action: string, changes: object) {
  await db().from("audit_log").insert({ entity, entity_id: entityId, action, changed_by: by, changes });
}

// ---------------------------------------------------------------- roster

export async function saveRoster(_: AState, f: FormData): Promise<AState> {
  const admin = await requireUser("admin");
  const day = String(f.get("day"));
  if (!isDay(day)) return { error: "Pick a valid date." };
  const [agents, processes] = await Promise.all([getAgents(), getProcesses()]);
  const rows: { day: string; user_id: string; process_id: string; created_by: string }[] = [];
  for (const a of agents) {
    if (f.get(`on_${a.id}`) !== "on") continue;
    const procs = processes.filter((p) => f.get(`p_${a.id}_${p.id}`) === "on");
    if (!procs.length) return { error: `${a.full_name} is marked working but has no process. Tick at least one, or untick Working.` };
    procs.forEach((p) => rows.push({ day, user_id: a.id, process_id: p.id, created_by: admin.id }));
  }
  const client = db();
  const { error: delErr } = await client.from("roster_entries").delete().eq("day", day);
  if (delErr) return { error: delErr.message };
  if (rows.length) {
    const { error } = await client.from("roster_entries").insert(rows);
    if (error) return { error: error.message };
  }
  await audit(admin.id, "roster", day, "save", { entries: rows.length });
  revalidatePath("/admin/roster");
  return { ok: `Roster saved for ${day}: ${new Set(rows.map((r) => r.user_id)).size} agent(s) working.` };
}

export async function copyRoster(_: AState, f: FormData): Promise<AState> {
  const admin = await requireUser("admin");
  const from = String(f.get("from"));
  const to = String(f.get("to"));
  if (!isDay(from) || !isDay(to)) return { error: "Pick valid dates." };
  const client = db();
  const { data } = await client.from("roster_entries").select("user_id, process_id").eq("day", from);
  if (!data?.length) return { error: `No roster on ${from} to copy.` };
  await client.from("roster_entries").delete().eq("day", to);
  const { error } = await client.from("roster_entries").insert(data.map((r) => ({ ...r, day: to, created_by: admin.id })));
  if (error) return { error: error.message };
  revalidatePath("/admin/roster");
  return { ok: `Copied ${from} to ${to}.` };
}

// ---------------------------------------------------------------- missed calls

/** Parses pasted dialer rows: a mobile number and an optional date/time per line (comma, tab or space separated). */
function parseMissed(text: string) {
  const out: { phone: string | null; raw: string; at: string | null }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || /^(mobile|phone|number|caller)/i.test(raw)) continue;
    const parts = raw.split(/[,\t;]+/).map((s) => s.trim()).filter(Boolean);
    const phoneCell = parts.find((p) => p.replace(/\D/g, "").length >= 10 && p.replace(/\D/g, "").length <= 13) ?? parts[0];
    const rest = parts.filter((p) => p !== phoneCell).join(" ");
    let at: string | null = null;
    const m = rest.match(/(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})(?::\d{2})?/) ?? rest.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}:\d{2})/);
    if (m) {
      const iso = m.length === 3 ? `${m[1]}T${m[2].padStart(5, "0")}` : `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T${m[4].padStart(5, "0")}`;
      at = fromISTInput(iso);
    }
    out.push({ phone: normalizePhone(phoneCell), raw, at });
  }
  return out;
}

export async function importMissedCalls(_: AState, f: FormData): Promise<AState> {
  const admin = await requireUser("admin");
  let text = String(f.get("text") ?? "");
  const file = f.get("file");
  if (file && typeof file === "object" && "text" in file && (file as File).size > 0) {
    if ((file as File).size > 2_000_000) return { error: "File is too large (max 2 MB). Upload a CSV." };
    text += "\n" + (await (file as File).text());
  }
  const rows = parseMissed(text);
  if (!rows.length) return { error: "Paste or upload at least one missed call." };

  const day = istToday();
  const onDuty = await agentsOnDuty(day, "missed");
  if (!onDuty.length) return { error: "No agent is rostered on Missed calls today. Set today’s roster first." };

  const client = db();
  const sla = await getSla();
  const details: string[] = [];
  let created = 0, attached = 0, skipped = 0;

  // De-duplicate numbers within the upload (keep the latest call).
  const byPhone = new Map<string, { at: string | null; count: number }>();
  for (const r of rows) {
    if (!r.phone) {
      skipped++;
      details.push(`Skipped “${r.raw}”: not a valid mobile number`);
      continue;
    }
    const prev = byPhone.get(r.phone);
    byPhone.set(r.phone, { at: r.at && (!prev?.at || r.at > prev.at) ? r.at : prev?.at ?? r.at, count: (prev?.count ?? 0) + 1 });
  }

  // Numbers that already have an open ticket: log the missed call on it instead of creating a new one.
  const phones = [...byPhone.keys()];
  const { data: open } = phones.length
    ? await client.from("tickets").select("id, code, phone, alt_phone, owner_id").eq("is_closed", false).is("parent_ticket_id", null)
        .or(phones.flatMap((p) => [`phone.eq.${p}`, `alt_phone.eq.${p}`]).join(","))
    : { data: [] };
  const openByPhone = new Map<string, { id: number; code: string }>();
  for (const t of open ?? []) {
    if (t.phone && !openByPhone.has(t.phone)) openByPhone.set(t.phone, t);
    if (t.alt_phone && !openByPhone.has(t.alt_phone)) openByPhone.set(t.alt_phone, t);
  }

  const toCreate = phones.filter((p) => !openByPhone.has(p));
  const owners = await roundRobin("missed", onDuty.map((a) => a.id), toCreate.length);
  const nowIso = new Date().toISOString();

  for (const p of phones) {
    const info = byPhone.get(p)!;
    const when = info.at ?? nowIso;
    const note = `Missed call${info.count > 1 ? ` (${info.count} calls)` : ""} at ${new Date(when).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;
    const existing = openByPhone.get(p);
    if (existing) {
      await client.from("ticket_contacts").insert({ ticket_id: existing.id, at: when, by: admin.id, direction: "Inbound", mode: "Call", outcome: "Not responded", note: `${note}. Call back.` });
      await client.from("tickets").update({ next_followup_at: nowIso, next_followup_reason: "Internal follow-up", updated_at: nowIso }).eq("id", existing.id);
      attached++;
      details.push(`${p}: logged on open ticket ${existing.code}`);
      continue;
    }
    // Customer details from order data, if we know them.
    const { data: o } = await client.from("orders").select("customer_name, address_line1, address_line2, city, state, pincode").eq("phone", p).order("order_date", { ascending: false }).limit(1).maybeSingle();
    const { data: code } = await client.rpc("next_ticket_code", { p_type: "enquiry", p_channel: "NA" });
    const owner = owners[toCreate.indexOf(p)];
    const { data: t, error } = await client.from("tickets").insert({
      code,
      type: "enquiry",
      order_channel: "NA",
      customer_name: o?.customer_name ?? null,
      phone: p,
      address: o ? [o.address_line1, o.address_line2, o.city, o.state].filter(Boolean).join(", ") || null : null,
      pincode: o?.pincode ?? null,
      source: "Inbound call",
      source_detail: "Missed call",
      category: "Other",
      details: `${note}. Call back to find out what the customer needs.`,
      status: "Open",
      owner_id: owner,
      created_by: admin.id,
      next_followup_at: nowIso,
      next_followup_reason: "Internal follow-up",
      sla_hours: sla.enquiry.hours,
      created_at: nowIso,
    }).select("id, code").single();
    if (error || !t) {
      skipped++;
      details.push(`${p}: could not create ticket (${error?.message})`);
      continue;
    }
    await client.from("ticket_contacts").insert({ ticket_id: t.id, at: when, by: admin.id, direction: "Inbound", mode: "Call", outcome: "Not responded", note });
    await audit(admin.id, "ticket", String(t.id), "create", { code: t.code, source: "Missed call upload", owner });
    created++;
    details.push(`${p}: created ${t.code} → ${onDuty.find((a) => a.id === owner)?.full_name}`);
  }

  await client.from("missed_call_imports").insert({ uploaded_by: admin.id, rows_total: rows.length, created, attached, skipped, notes: details });
  revalidatePath("/admin/missed-calls");
  return { ok: `${created} ticket(s) created, ${attached} logged on existing tickets, ${skipped} skipped.`, details };
}

// ---------------------------------------------------------------- cover (temporary assignment)

export async function assignCover(_: AState, f: FormData): Promise<AState> {
  const admin = await requireUser("admin");
  const ids = f.getAll("ticket").map(Number).filter(Boolean);
  if (!ids.length) return { error: "Select at least one ticket." };
  const mode = String(f.get("mode"));
  const from = fromISTInput(f.get("from"));
  const to = fromISTInput(f.get("to"));
  if (!from || !to || to <= from) return { error: "Set a valid cover window (from before to)." };
  const absent = new Set(f.getAll("absent").map(String));

  let assignees: string[];
  if (mode === "user") {
    const u = String(f.get("user") ?? "");
    if (!u) return { error: "Choose who covers." };
    if (absent.has(u)) return { error: "That person is marked absent." };
    assignees = ids.map(() => u);
  } else {
    const day = new Date(new Date(from).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const present = (await agentsOnDuty(day)).map((a) => a.id).filter((id) => !absent.has(id));
    if (!present.length) return { error: `No one else is rostered on ${day}. Set the roster or pick a person.` };
    assignees = await roundRobin("cover", present, ids.length);
  }

  const client = db();
  const { data: tickets } = await client.from("tickets").select("id, owner_id").in("id", ids);
  let done = 0;
  for (const [i, id] of ids.entries()) {
    const t = tickets?.find((x) => x.id === id);
    if (!t) continue;
    if (t.owner_id === assignees[i]) continue; // owner covering themselves makes no sense
    await client.from("tickets").update({ temp_owner_id: assignees[i], temp_owner_from: from, temp_owner_to: to, updated_at: new Date().toISOString() }).eq("id", id);
    await audit(admin.id, "ticket", String(id), "update", { temp_owner_id: { from: null, to: assignees[i] }, cover_until: to });
    done++;
  }
  revalidatePath("/admin/cover");
  return { ok: `${done} ticket(s) covered until ${new Date(to).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.` };
}

export async function clearCover(_: AState, f: FormData): Promise<AState> {
  const admin = await requireUser("admin");
  const ids = f.getAll("ticket").map(Number).filter(Boolean);
  if (!ids.length) return { error: "Select at least one ticket." };
  await db().from("tickets").update({ temp_owner_id: null, temp_owner_from: null, temp_owner_to: null }).in("id", ids);
  for (const id of ids) await audit(admin.id, "ticket", String(id), "update", { temp_owner_id: { from: "cover", to: null } });
  revalidatePath("/admin/cover");
  return { ok: `Cover removed from ${ids.length} ticket(s).` };
}

// ---------------------------------------------------------------- edit-access requests

export async function requestEditAccess(_: AState, f: FormData): Promise<AState> {
  const user = await requireUser();
  const ticketId = Number(f.get("ticket_id"));
  const reason = String(f.get("reason") ?? "").trim();
  if (!reason) return { error: "Say why you need to edit this ticket." };
  const client = db();
  const { data: pending } = await client.from("edit_requests").select("id").eq("ticket_id", ticketId).eq("requested_by", user.id).eq("status", "pending").maybeSingle();
  if (pending) return { error: "You already have a pending request for this ticket." };
  const { error } = await client.from("edit_requests").insert({ ticket_id: ticketId, requested_by: user.id, reason });
  if (error) return { error: error.message };
  revalidatePath("/admin/approvals");
  return { ok: "Request sent to the admins." };
}

export async function decideEditRequest(_: AState, f: FormData): Promise<AState> {
  const admin = await requireUser("admin");
  const id = Number(f.get("id"));
  const approve = f.get("decision") === "approve";
  const hours = Math.min(72, Math.max(1, Number(f.get("hours")) || 4));
  const client = db();
  const { data: r } = await client.from("edit_requests").select("*").eq("id", id).maybeSingle();
  if (!r || r.status !== "pending") return { error: "Request not found or already decided." };
  const now = new Date();
  const until = new Date(now.getTime() + hours * 3600_000).toISOString();
  await client.from("edit_requests").update({
    status: approve ? "approved" : "rejected", decided_by: admin.id, decided_at: now.toISOString(), access_until: approve ? until : null,
  }).eq("id", id);
  if (approve) {
    // Same mechanism as cover: the requester becomes the temporary owner for the window.
    await client.from("tickets").update({ temp_owner_id: r.requested_by, temp_owner_from: now.toISOString(), temp_owner_to: until }).eq("id", r.ticket_id);
    await audit(admin.id, "ticket", String(r.ticket_id), "update", { temp_owner_id: { from: null, to: r.requested_by }, edit_access_hours: hours });
  }
  revalidatePath("/admin/approvals");
  return { ok: approve ? `Approved for ${hours}h.` : "Rejected." };
}

