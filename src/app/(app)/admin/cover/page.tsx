import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { agentsOnDuty, getAgents, istDayBounds, istToday } from "@/lib/assignment/queries";
import { assignCover, clearCover } from "@/lib/assignment/actions";
import { SLA_FLAG_LABEL, SLA_FLAG_TONE, STATUS_TONE } from "@/lib/tickets/constants";
import { endOfTodayIST, type TicketListRow } from "@/lib/tickets/queries";
import { fmtDateTime, toISTInput } from "@/lib/format";
import { Badge, buttonClass, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/form";
import { CoverMode } from "./cover-mode";

const COLS = "id, code, type, category, customer_name, phone, display_status, sla_flag, next_followup_at, owner_id, owner_name, temp_owner_name, temp_owner_to";

function TicketRows({ rows }: { rows: (Pick<TicketListRow, "id" | "code" | "category" | "customer_name" | "display_status" | "sla_flag" | "next_followup_at" | "owner_name" | "temp_owner_name"> & { temp_owner_to?: string | null })[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="ds-table min-w-[760px]">
        <thead>
          <tr><th className="w-8"><span className="sr-only">Select</span></th><th>Ticket</th><th>Owner</th><th>Customer</th><th>Status</th><th>SLA</th><th>Next Follow-up</th><th>Covering</th></tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td><input type="checkbox" name="ticket" value={t.id} defaultChecked aria-label={`Select ${t.code}`} className="h-4 w-4 accent-[var(--ds-background-brand-bold)]" /></td>
              <td><Link href={`/tickets/${encodeURIComponent(t.code)}`} className="font-mono text-[13px] text-ds-link hover:underline">{t.code}</Link><div className="text-xs text-ds-text-subtlest">{t.category}</div></td>
              <td>{t.owner_name ?? <Empty />}</td>
              <td>{t.customer_name ?? <Empty />}</td>
              <td><Badge tone={STATUS_TONE[t.display_status] ?? "neutral"}>{t.display_status}</Badge></td>
              <td><Badge tone={SLA_FLAG_TONE[t.sla_flag]}>{SLA_FLAG_LABEL[t.sla_flag]}</Badge></td>
              <td className="whitespace-nowrap">{fmtDateTime(t.next_followup_at)}</td>
              <td>{t.temp_owner_name ? <>{t.temp_owner_name}<div className="text-xs text-ds-text-subtlest">until {fmtDateTime(t.temp_owner_to)}</div></> : <Empty />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CoverPage({ searchParams }: PageProps<"/admin/cover">) {
  await requireUser("admin");
  const sp = await searchParams;
  const absent = ([] as string[]).concat(sp.absent ?? []).filter(Boolean);
  const scope = sp.scope === "all" ? "all" : "today";
  const today = istToday();
  const [agents, present] = await Promise.all([getAgents(), agentsOnDuty(today)]);
  const presentOthers = present.filter((a) => !absent.includes(a.id));

  let rows: TicketListRow[] = [];
  if (absent.length) {
    let q = db().from("ticket_view").select(COLS).eq("is_closed", false).in("owner_id", absent);
    if (scope === "today") q = q.or(`next_followup_at.lte.${endOfTodayIST()},sla_flag.in.(attention,delayed)`);
    const { data } = await q.order("next_followup_at", { ascending: true, nullsFirst: true }).limit(300);
    rows = (data ?? []) as unknown as TicketListRow[];
  }
  const nowIso = new Date().toISOString();
  const { data: covered } = await db().from("ticket_view").select(COLS).eq("is_closed", false).not("temp_owner_id", "is", null).gte("temp_owner_to", nowIso).order("temp_owner_to");

  const { end } = istDayBounds(today);

  return (
    <>
      <PageHeader title="Cover" description="When an agent is on leave, hand their tickets that need attention to the people working today. The owner doesn’t change; the cover only lasts for the window you set." />

      <Card className="mb-6">
        <CardHeader title="1. Who is away?" />
        <form method="get" className="space-y-3 p-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {agents.map((a) => (
              <label key={a.id} className="flex items-center gap-2">
                <input type="checkbox" name="absent" value={a.id} defaultChecked={absent.includes(a.id)} className="h-4 w-4 accent-[var(--ds-background-brand-bold)]" />
                {a.full_name}
                {!present.some((p) => p.id === a.id) && <span className="text-xs text-ds-text-subtlest">(not rostered today)</span>}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2"><input type="radio" name="scope" value="today" defaultChecked={scope === "today"} /> Due today or needing attention</label>
            <label className="flex items-center gap-2"><input type="radio" name="scope" value="all" defaultChecked={scope === "all"} /> All their open tickets</label>
            <button className={buttonClass("selected")}>Show tickets</button>
          </div>
        </form>
      </Card>

      {absent.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <CardHeader title={`2. Their tickets (${rows.length})`} />
          {rows.length === 0 ? (
            <p className="p-4 text-ds-text-subtle">Nothing needs cover for this selection.</p>
          ) : (
            <ActionForm action={assignCover} submitLabel="Assign cover" footerClass="px-4" className="pb-4">
              {absent.map((a) => <input key={a} type="hidden" name="absent" value={a} />)}
              <TicketRows rows={rows} />
              <div className="grid gap-4 border-t border-ds-border px-4 pt-4 lg:grid-cols-[1fr_1fr_1fr]">
                <CoverMode people={presentOthers.map((p) => ({ id: p.id, name: p.full_name }))} allPeople={agents.filter((a) => !absent.includes(a.id)).map((p) => ({ id: p.id, name: p.full_name }))} />
                <Field label="From" htmlFor="from"><input id="from" name="from" type="datetime-local" defaultValue={toISTInput(nowIso)} className="ds-input" /></Field>
                <Field label="Until" htmlFor="to"><input id="to" name="to" type="datetime-local" defaultValue={toISTInput(end)} className="ds-input" /></Field>
              </div>
            </ActionForm>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader title={`Currently covered (${covered?.length ?? 0})`} />
        {covered?.length ? (
          <ActionForm action={clearCover} submitLabel="Remove cover from selected" footerClass="px-4" className="pb-4" confirmText="Remove cover from the selected tickets?">
            <TicketRows rows={covered as unknown as TicketListRow[]} />
          </ActionForm>
        ) : (
          <p className="p-4 text-ds-text-subtle">No active cover.</p>
        )}
      </Card>
    </>
  );
}

