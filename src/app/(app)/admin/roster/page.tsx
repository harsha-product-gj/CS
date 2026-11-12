import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getAgents, getProcesses, getRoster, isDay, istToday } from "@/lib/assignment/queries";
import { copyRoster, saveRoster } from "@/lib/assignment/actions";
import { buttonClass, Card, CardHeader, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { RosterRow } from "./roster-row";

function shift(day: string, n: number) {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);
}
const label = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export default async function RosterPage({ searchParams }: PageProps<"/admin/roster">) {
  await requireUser("admin");
  const sp = await searchParams;
  const day = isDay(sp.day) ? sp.day : istToday();
  const [agents, processes, roster] = await Promise.all([getAgents(), getProcesses(), getRoster(day)]);
  const working = agents.filter((a) => roster.has(a.id)).length;

  return (
    <>
      <PageHeader title="Roster" description="Who is working which process each day. Round-robin and cover only use the people rostered that day." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/admin/roster?day=${shift(day, -1)}`} className={buttonClass("subtle")} aria-label="Previous day"><ChevronLeft size={16} /></Link>
        <form method="get" className="flex items-center gap-2">
          <input type="date" name="day" defaultValue={day} className="ds-input h-8 w-auto" />
          <button className={buttonClass("default")}>Go</button>
        </form>
        <Link href={`/admin/roster?day=${shift(day, 1)}`} className={buttonClass("subtle")} aria-label="Next day"><ChevronRight size={16} /></Link>
        {day !== istToday() && <Link href="/admin/roster" className={buttonClass("subtle")}>Today</Link>}
        <span className="ml-2 font-medium">{label(day)}</span>
        <span className="text-ds-text-subtle">· {working} of {agents.length} working</span>
      </div>

      <Card className="mb-6 overflow-hidden">
        <CardHeader title="Agents" />
        {agents.length === 0 ? (
          <p className="p-4 text-ds-text-subtle">No active users with the Agent role. Add them under Users.</p>
        ) : (
          <ActionForm action={saveRoster} submitLabel="Save roster" className="pb-4" footerClass="px-4">
            <input type="hidden" name="day" value={day} />
            <div className="overflow-x-auto">
              <table className="ds-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Working</th>
                    {processes.map((p) => <th key={p.id}>{p.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <RosterRow key={`${day}-${a.id}`} agent={{ id: a.id, name: a.full_name }} processes={processes.map((p) => p.id)} selected={[...(roster.get(a.id) ?? [])]} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4" />
          </ActionForm>
        )}
      </Card>

      <Card className="max-w-xl">
        <CardHeader title="Copy a day" />
        <ActionForm action={copyRoster} submitLabel="Copy roster" className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span>Copy</span>
            <input type="date" name="from" defaultValue={shift(day, -1)} className="ds-input h-8 w-auto" />
            <span>to</span>
            <input type="date" name="to" defaultValue={day} className="ds-input h-8 w-auto" />
          </div>
          <p className="mt-2 text-xs text-ds-text-subtlest">Replaces the roster on the target day. Excel upload of rosters comes later.</p>
        </ActionForm>
      </Card>
    </>
  );
}
