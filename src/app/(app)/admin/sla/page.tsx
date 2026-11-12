import { requireUser } from "@/lib/auth";
import { getSla } from "@/lib/tickets/queries";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { SlaForm } from "./sla-form";

export default async function SlaPage() {
  await requireUser("admin");
  const sla = await getSla();
  const rows = ["enquiry", "complaint", "evidence_followup", "evidence_attention"].map((k) => sla[k]).filter(Boolean);
  return (
    <>
      <PageHeader title="SLA settings" description="Hours are calendar hours. Each ticket keeps the SLA in force when it was created." />
      <Card className="max-w-2xl">
        <CardHeader title="Tickets" />
        <div className="p-4">
          <SlaForm rows={rows.map((r) => ({ key: r.key, label: r.label, hours: Number(r.hours), updated: fmtDateTime(r.updated_at) }))} />
        </div>
      </Card>
      <p className="mt-4 max-w-2xl text-ds-text-subtle">
        Time the ticket spends waiting on the customer (awaiting evidence, or a call-back time the customer chose) is added to the deadline and reported separately as customer wait.
      </p>
    </>
  );
}
