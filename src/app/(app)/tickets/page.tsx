import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listTickets, myCounts } from "@/lib/tickets/queries";
import { Pager } from "@/components/tickets/pager";
import { TicketTable } from "@/components/tickets/ticket-table";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";

const VIEWS = [
  { id: "due", label: "Due today" },
  { id: "attention", label: "Needs attention" },
  { id: "open", label: "All open" },
  { id: "closed", label: "Closed" },
] as const;

export default async function MyTicketsPage({ searchParams }: PageProps<"/tickets">) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = (VIEWS.find((v) => v.id === sp.view)?.id ?? "due") as (typeof VIEWS)[number]["id"];
  const page = Number(sp.page) || 1;
  const [{ rows, total }, counts] = await Promise.all([listTickets({ mine: user.id, view, page }), myCounts(user.id)]);
  const countFor = { due: counts.due, attention: counts.attention, open: counts.open, closed: undefined } as Record<string, number | undefined>;

  return (
    <>
      <PageHeader
        title="My tickets"
        description="Tickets you own or are covering, soonest follow-up first."
        actions={<Link href="/tickets/new" className={buttonClass("primary")}><Plus size={16} aria-hidden /> New ticket</Link>}
      />
      <div role="tablist" className="mb-4 flex gap-4 overflow-x-auto border-b border-ds-border">
        {VIEWS.map((v) => {
          const on = v.id === view;
          return (
            <Link key={v.id} href={`/tickets?view=${v.id}`} role="tab" aria-selected={on}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-2 ${on ? "border-ds-border-selected font-medium text-ds-text-selected" : "border-transparent text-ds-text"}`}>
              {v.label}
              {countFor[v.id] !== undefined && (
                <span className={`rounded-ds-small px-1.5 text-xs font-semibold ${on ? "bg-ds-background-selected text-ds-text-selected" : "bg-ds-background-neutral text-ds-text-subtle"}`}>
                  {countFor[v.id]}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <Card className="overflow-hidden">
        {rows.length ? (
          <TicketTable rows={rows} showOwner={false} />
        ) : (
          <EmptyState icon={<Inbox size={40} strokeWidth={1.5} />} title={view === "due" ? "Nothing due today" : "No tickets here"}>
            {view === "due" ? "All your follow-ups are on schedule." : "Tickets you create or are assigned will show up here."}
          </EmptyState>
        )}
      </Card>
      <Pager total={total} page={page} base={`/tickets?view=${view}`} />
    </>
  );
}
