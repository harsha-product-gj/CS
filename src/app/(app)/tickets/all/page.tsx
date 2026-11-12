import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStaff, listTickets } from "@/lib/tickets/queries";
import { SLA_FLAG_LABEL, SOURCES } from "@/lib/tickets/constants";
import { TicketTable } from "@/components/tickets/ticket-table";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { Pager } from "@/components/tickets/pager";

const STATUS_FILTER = ["Open", "In progress", "Awaiting evidence", "Follow up for evidence", "Resolved"];
const VIEW_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "attention", label: "Needs attention / delayed" },
  { value: "due", label: "Due today" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "Everything" },
];

export default async function AllTicketsPage({ searchParams }: PageProps<"/tickets/all">) {
  await requireUser();
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const view = (VIEW_OPTIONS.find((v) => v.value === s("view"))?.value ?? "open") as "open" | "attention" | "due" | "closed" | "all";
  const page = Number(s("page")) || 1;
  const filter = { view, status: s("status"), type: s("type"), source: s("source"), owner: s("owner"), flag: s("flag"), q: s("q"), page };
  const [{ rows, total }, staff] = await Promise.all([listTickets(filter), getStaff()]);

  const qs = new URLSearchParams(Object.entries({ ...filter, page: "" }).filter(([, v]) => v) as [string, string][]).toString();
  const sel = "ds-input h-8 w-auto pr-8";

  return (
    <>
      <PageHeader
        title="All tickets"
        description="Every ticket across the team."
        actions={<Link href="/tickets/new" className={buttonClass("primary")}><Plus size={16} aria-hidden /> New ticket</Link>}
      />
      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <input name="q" defaultValue={filter.q} placeholder="Ticket ID, order ID, mobile, name" className="ds-input h-8 w-64" />
        <select name="view" defaultValue={view} className={sel}>{VIEW_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</select>
        <select name="type" defaultValue={filter.type} className={sel}><option value="">Any type</option><option value="complaint">Complaint</option><option value="enquiry">Enquiry</option></select>
        <select name="status" defaultValue={filter.status} className={sel}><option value="">Any status</option>{STATUS_FILTER.map((x) => <option key={x}>{x}</option>)}</select>
        <select name="flag" defaultValue={filter.flag} className={sel}><option value="">Any SLA</option>{Object.entries(SLA_FLAG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="source" defaultValue={filter.source} className={sel}><option value="">Any source</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select>
        <select name="owner" defaultValue={filter.owner} className={sel}><option value="">Anyone</option>{staff.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
        <button className={buttonClass("selected")}>Apply</button>
        {qs !== "view=open" && <Link href="/tickets/all" className={buttonClass("subtle")}>Clear</Link>}
      </form>
      <Card className="overflow-hidden">
        {rows.length ? (
          <TicketTable rows={rows} />
        ) : (
          <EmptyState icon={<Inbox size={40} strokeWidth={1.5} />} title="No tickets match">Try a different filter.</EmptyState>
        )}
      </Card>
      <Pager total={total} page={page} base={`/tickets/all?${qs}`} />
    </>
  );
}
