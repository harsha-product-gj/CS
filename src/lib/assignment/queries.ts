import "server-only";
import { db } from "@/lib/supabase/server";

/** Today's date in IST as YYYY-MM-DD. */
export function istToday(offsetDays = 0) {
  return new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
}

/** Start/end of an IST day as ISO timestamps. */
export function istDayBounds(day: string) {
  const start = new Date(`${day}T00:00:00+05:30`);
  const end = new Date(`${day}T23:59:59.999+05:30`);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function isDay(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
}

export async function getProcesses() {
  const { data, error } = await db().from("processes").select("id, name, sort, active").eq("active", true).order("sort");
  if (error) throw error;
  return data ?? [];
}

/** Active users with the agent role. */
export async function getAgents() {
  const { data, error } = await db().from("profiles").select("id, full_name, username, roles, active").eq("active", true).order("full_name");
  if (error) throw error;
  return (data ?? []).filter((p) => (p.roles as string[]).includes("agent"));
}

/** day → Map(userId → Set(processId)) */
export async function getRoster(day: string) {
  const { data, error } = await db().from("roster_entries").select("user_id, process_id").eq("day", day);
  if (error) throw error;
  const m = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    if (!m.has(r.user_id)) m.set(r.user_id, new Set());
    m.get(r.user_id)!.add(r.process_id);
  }
  return m;
}

/** Agents rostered on a day (optionally for one process), in a stable order. */
export async function agentsOnDuty(day: string, processId?: string) {
  const [agents, roster] = await Promise.all([getAgents(), getRoster(day)]);
  return agents.filter((a) => {
    const p = roster.get(a.id);
    return p && (!processId || p.has(processId));
  });
}

/**
 * Round-robin: returns `n` assignees from `candidates` (ids, in a stable order),
 * continuing after whoever got the last item in this pool, and saves the pointer.
 */
export async function roundRobin(pool: string, candidates: string[], n: number) {
  if (!candidates.length || n <= 0) return [] as string[];
  const client = db();
  const { data } = await client.from("round_robin").select("last_user_id").eq("pool", pool).maybeSingle();
  let idx = data?.last_user_id ? candidates.indexOf(data.last_user_id) : -1;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % candidates.length;
    out.push(candidates[idx]);
  }
  await client.from("round_robin").upsert({ pool, last_user_id: out[out.length - 1], updated_at: new Date().toISOString() });
  return out;
}
