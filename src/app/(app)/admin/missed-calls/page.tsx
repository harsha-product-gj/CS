import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { agentsOnDuty, istToday } from "@/lib/assignment/queries";
import { importMissedCalls } from "@/lib/assignment/actions";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { Field, TextArea } from "@/components/form";
import { fmtDateTime } from "@/lib/format";

export default async function MissedCallsPage() {
  await requireUser("admin");
  const [onDuty, { data: imports }] = await Promise.all([
    agentsOnDuty(istToday(), "missed"),
    db().from("missed_call_imports").select("id, uploaded_at, rows_total, created, attached, skipped, uploaded_by").order("uploaded_at", { ascending: false }).limit(10),
  ]);

  return (
    <>
      <PageHeader title="Missed calls" description="Upload missed inbound calls from the dialer. Each number becomes a ticket, shared round-robin among today’s Missed calls agents." />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Upload" />
          <ActionForm action={importMissedCalls} submitLabel="Create tickets" pendingLabel="Importing…" className="p-4">
            <div className="space-y-4">
              <Field label="Paste rows" htmlFor="text" hint="One call per line: mobile number, then the call time if you have it, e.g. 9876543210, 2026-11-12 10:42  or  9876543210, 12/11/2026 10:42">
                <TextArea id="text" name="text" rows={8} className="font-mono" placeholder={"9876543210, 2026-11-12 10:42\n+91 98765 43211, 2026-11-12 11:05"} />
              </Field>
              <Field label="…or upload a CSV" htmlFor="file">
                <input id="file" name="file" type="file" accept=".csv,.txt" className="block text-ds-text-subtle file:mr-3 file:h-8 file:rounded-ds-medium file:border-0 file:bg-ds-background-neutral file:px-3 file:text-ds-text-subtle" />
              </Field>
              <ul className="list-disc space-y-1 pl-5 text-ds-text-subtle">
                <li>A number that already has an open ticket gets the missed call logged on that ticket (with an immediate follow-up) instead of a new one.</li>
                <li>New tickets are Enquiry · Other · source “Inbound call (Missed call)”, with customer details from the order data when we know the number. The agent converts it to a complaint if needed.</li>
                <li>Repeat calls from the same number in one upload become one ticket.</li>
              </ul>
            </div>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="ds-heading-xsmall mb-2">On Missed calls today</h2>
            {onDuty.length ? (
              <ul className="space-y-1">{onDuty.map((a) => <li key={a.id}>{a.full_name}</li>)}</ul>
            ) : (
              <p className="text-ds-text-warning">Nobody yet. <Link href="/admin/roster" className="text-ds-link underline">Set today’s roster</Link> first.</p>
            )}
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Recent uploads" />
            {imports?.length ? (
              <table className="ds-table">
                <thead><tr><th>When</th><th className="ds-num">New</th><th className="ds-num">Logged</th><th className="ds-num">Skipped</th></tr></thead>
                <tbody>
                  {imports.map((i) => (
                    <tr key={i.id}>
                      <td>{fmtDateTime(i.uploaded_at)}</td>
                      <td className="ds-num">{i.created}</td>
                      <td className="ds-num">{i.attached}</td>
                      <td className="ds-num">{i.skipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-4"><Empty /></p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
