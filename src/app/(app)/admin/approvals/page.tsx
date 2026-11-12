import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { decideEditRequest } from "@/lib/assignment/actions";
import { getStaff } from "@/lib/tickets/queries";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { DecisionButtons } from "./decision-buttons";

export default async function ApprovalsPage() {
  await requireUser("admin");
  const client = db();
  const [{ data: pending }, { data: recent }, staff] = await Promise.all([
    client.from("edit_requests").select("id, ticket_id, requested_by, reason, created_at").eq("status", "pending").order("created_at"),
    client.from("edit_requests").select("id, ticket_id, requested_by, status, decided_by, decided_at, access_until").neq("status", "pending").order("decided_at", { ascending: false }).limit(20),
    getStaff(),
  ]);
  const ids = [...new Set([...(pending ?? []), ...(recent ?? [])].map((r) => r.ticket_id))];
  const { data: tickets } = ids.length
    ? await client.from("ticket_view").select("id, code, category, owner_name, display_status").in("id", ids)
    : { data: [] };
  const tk = new Map((tickets ?? []).map((t) => [t.id, t]));
  const name = new Map(staff.map((s) => [s.id, s.full_name as string]));

  return (
    <>
      <PageHeader title="Approvals" description="Agents asking to edit a ticket they don’t own. Approving makes them the temporary owner for the hours you choose." />

      <Card className="mb-6 overflow-hidden">
        <CardHeader title={`Pending (${pending?.length ?? 0})`} />
        {pending?.length ? (
          <ul className="divide-y divide-ds-border">
            {pending.map((r) => {
              const t = tk.get(r.ticket_id);
              return (
                <li key={r.id} className="px-4 py-3">
                  <ActionForm action={decideEditRequest} submitLabel="" footer={<DecisionButtons />}>
                    <input type="hidden" name="id" value={r.id} />
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-medium">{name.get(r.requested_by) ?? "Someone"}</span>
                      <span className="text-ds-text-subtle">wants to edit</span>
                      {t && <Link href={`/tickets/${encodeURIComponent(t.code)}`} className="font-mono text-[13px] text-ds-link hover:underline">{t.code}</Link>}
                      {t && <span className="text-ds-text-subtle">· {t.category} · owner {t.owner_name ?? "—"}</span>}
                      <span className="ml-auto text-xs text-ds-text-subtlest">{fmtDateTime(r.created_at)}</span>
                    </div>
                    <p className="mt-1">“{r.reason}”</p>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-4 text-ds-text-subtle">No pending requests.</p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Recent decisions" />
        {recent?.length ? (
          <table className="ds-table">
            <thead><tr><th>Ticket</th><th>Requested by</th><th>Decision</th><th>By</th><th>Access until</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-[13px]">{tk.get(r.ticket_id)?.code ?? r.ticket_id}</td>
                  <td>{name.get(r.requested_by) ?? "—"}</td>
                  <td><Badge tone={r.status === "approved" ? "success" : "danger"}>{r.status === "approved" ? "Approved" : "Rejected"}</Badge></td>
                  <td>{(r.decided_by && name.get(r.decided_by)) ?? "—"}</td>
                  <td>{r.access_until ? fmtDateTime(r.access_until) : <Empty />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-ds-text-subtle">None yet.</p>
        )}
      </Card>
    </>
  );
}
