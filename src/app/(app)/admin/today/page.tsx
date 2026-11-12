import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getAgents, getProcesses, getRoster, istToday } from "@/lib/assignment/queries";
import { endOfTodayIST, type TicketListRow } from "@/lib/tickets/queries";
import { TicketTable } from "@/components/tickets/ticket-table";
import { Badge, buttonClass, Card, CardHeader, Empty, PageHeader } from "@/components/ui";

const COLS =
  "id, code, type, category, source, source_detail, order_code, order_channel, customer_name, phone, display_status, status, sla_flag, deadline, next_followup_at, next_followup_reason, owner_id, owner_name, temp_owner_id, temp_owner_name, contacts_total, contacts_answered, last_contact_outcome, is_closed, parent_ticket_id, created_at, updated_at, resolution";

export default async function TeamTodayPage() {
  await requireUser("admin");
  const today = istToday();
  const [agents, processes, roster, { data: open }, { count: pendingApprovals }] = await Promise.all([
    getAgents(),
    getProcesses(),
    getRoster(today),
    db().from("ticket_view").select(COLS).eq("is_closed", false).limit(2000),
    db().from("edit_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const tickets = (open ?? []) as TicketListRow[];
  const eod = endOfTodayIST();
  const pname = new Map(processes.map((p) => [p.id, p.name]));

  const stats = (id: string) => {
    const mine = tickets.filter((t) => t.owner_id === id);
    return {
      open: mine.length,
      due: mine.filter((t) => t.status !== "Resolved" && t.next_followup_at && t.next_followup_at <= eod).length,
      attention: mine.filter((t) => t.sla_flag === "attention").length,
      delayed: mine.filter((t) => t.sla_flag === "delayed").length,
      covering: tickets.filter((t) => t.temp_owner_id === id).length,
    };
  };
  const needs = tickets
    .filter((t) => t.sla_flag === "attention" || t.sla_flag === "delayed")
    .sort((a, b) => (a.sla_flag === "delayed" ? -1 : 0) - (b.sla_flag === "delayed" ? -1 : 0) || (a.next_followup_at ?? "").localeCompare(b.next_followup_at ?? ""));
  const absentWithWork = agents.filter((a) => !roster.has(a.id) && stats(a.id).due + stats(a.id).attention + stats(a.id).delayed > 0);

  const tiles = [
    { label: "Open tickets", value: tickets.length },
    { label: "Due today", value: tickets.filter((t) => t.status !== "Resolved" && t.next_followup_at && t.next_followup_at <= eod).length },
    { label: "Needs attention", value: tickets.filter((t) => t.sla_flag === "attention").length, tone: "text-ds-text-warning" },
    { label: "Delayed", value: tickets.filter((t) => t.sla_flag === "delayed").length, tone: "text-ds-text-danger" },
    { label: "Unassigned", value: tickets.filter((t) => !t.owner_id).length },
    { label: "Edit requests", value: pendingApprovals ?? 0, href: "/admin/approvals" },
  ];

  return (
    <>
      <PageHeader
        title="Team today"
        description="Where things stand right now, and who needs cover."
        actions={<>
          <Link href="/admin/roster" className={buttonClass("default")}>Roster</Link>
          <Link href="/admin/cover" className={buttonClass("primary")}>Assign cover</Link>
        </>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => {
          const body = (
            <>
              <p className="ds-body-small text-ds-text-subtle">{t.label}</p>
              <p className={`ds-metric-large mt-3 ${t.value > 0 ? t.tone ?? "" : ""}`}>{t.value}</p>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="rounded-ds-large border border-ds-border bg-ds-surface p-3 hover:bg-ds-surface-hovered">{body}</Link>
          ) : (
            <div key={t.label} className="rounded-ds-large border border-ds-border bg-ds-surface p-3">{body}</div>
          );
        })}
      </div>

      {absentWithWork.length > 0 && (
        <Card className="mb-6 border-ds-border-warning bg-ds-background-warning p-4">
          <p className="font-semibold text-ds-text-warning">Not rostered today but has tickets needing work</p>
          <p className="mt-1">
            {absentWithWork.map((a) => a.full_name).join(", ")}.{" "}
            <Link className="text-ds-link underline" href={`/admin/cover?${absentWithWork.map((a) => `absent=${a.id}`).join("&")}`}>Assign cover</Link>
          </p>
        </Card>
      )}

      <Card className="mb-6 overflow-hidden">
        <CardHeader title="Agents" />
        <div className="overflow-x-auto">
          <table className="ds-table min-w-[760px]">
            <thead>
              <tr><th>Agent</th><th>Today</th><th className="ds-num">Open</th><th className="ds-num">Due Today</th><th className="ds-num">Needs Attention</th><th className="ds-num">Delayed</th><th className="ds-num">Covering</th></tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const s = stats(a.id);
                const procs = [...(roster.get(a.id) ?? [])].map((p) => pname.get(p) ?? p);
                return (
                  <tr key={a.id}>
                    <td><Link href={`/tickets/all?owner=${a.id}`} className="font-medium text-ds-link hover:underline">{a.full_name}</Link></td>
                    <td>{procs.length ? <div className="flex flex-wrap gap-1">{procs.map((p) => <Badge key={p}>{p}</Badge>)}</div> : <Badge tone="warning">Not rostered</Badge>}</td>
                    <td className="ds-num">{s.open}</td>
                    <td className="ds-num">{s.due || <Empty />}</td>
                    <td className={`ds-num ${s.attention ? "font-semibold text-ds-text-warning" : ""}`}>{s.attention || <Empty />}</td>
                    <td className={`ds-num ${s.delayed ? "font-semibold text-ds-text-danger" : ""}`}>{s.delayed || <Empty />}</td>
                    <td className="ds-num">{s.covering || <Empty />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={`Needs attention (${needs.length})`} />
        {needs.length ? <TicketTable rows={needs.slice(0, 100)} /> : <p className="p-4 text-ds-text-subtle">Nothing needs attention.</p>}
      </Card>
    </>
  );
}
