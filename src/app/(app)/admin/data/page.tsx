import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { channelLabel, fmtDateTime } from "@/lib/format";

export default async function OrderDataPage() {
  await requireUser("admin");
  const client = db();

  const [runs, unmapped, linked, channelCounts] = await Promise.all([
    client.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(10),
    client.from("orders").select("order_code, channel_name, order_date").eq("order_channel", "UNMAPPED").order("order_date", { ascending: false }).limit(50),
    client.from("orders").select("order_code, base_order_code, link_type").not("base_order_code", "is", null).limit(2000),
    Promise.all(
      ["FS", "AR", "AS", "SX", "WD", "UNMAPPED"].map(async (ch) => {
        const { count } = await client.from("orders").select("order_code", { count: "exact", head: true }).eq("order_channel", ch);
        return [ch, count ?? 0] as const;
      }),
    ),
  ]);

  // Linked shipments whose original order is not in the data
  const bases = [...new Set((linked.data ?? []).map((l) => l.base_order_code as string))];
  const found = new Set<string>();
  for (let i = 0; i < bases.length; i += 300) {
    const { data } = await client.from("orders").select("order_code").in("order_code", bases.slice(i, i + 300));
    data?.forEach((d) => found.add(d.order_code));
  }
  const orphans = (linked.data ?? []).filter((l) => !found.has(l.base_order_code as string));
  const total = channelCounts.reduce((a, [, n]) => a + n, 0);

  return (
    <>
      <PageHeader title="Order data" description="Orders imported from the DataBank sheet, and records that need a look." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div className="rounded-ds-large border border-ds-border bg-ds-surface p-3">
          <p className="ds-body-small text-ds-text-subtle">All orders</p>
          <p className="ds-metric-large mt-3">{total.toLocaleString("en-IN")}</p>
        </div>
        {channelCounts.map(([ch, n]) => (
          <div key={ch} className="rounded-ds-large border border-ds-border bg-ds-surface p-3">
            <p className="ds-body-small text-ds-text-subtle">{channelLabel(ch)}</p>
            <p className={`ds-metric-large mt-3 ${ch === "UNMAPPED" && n > 0 ? "text-ds-text-warning" : ""}`}>
              {n.toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </div>

      <Card className="mb-6 overflow-hidden">
        <CardHeader title="Recent imports" />
        <div className="overflow-x-auto">
          <table className="ds-table min-w-[560px]">
            <thead>
              <tr><th>Started</th><th>Source</th><th className="ds-num">Rows</th><th className="ds-num">Orders</th><th>Result</th></tr>
            </thead>
            <tbody>
              {runs.data?.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDateTime(r.started_at)}</td>
                  <td>{r.source}</td>
                  <td className="ds-num">{r.rows_read?.toLocaleString("en-IN") ?? <Empty />}</td>
                  <td className="ds-num">{r.orders_upserted?.toLocaleString("en-IN") ?? <Empty />}</td>
                  <td>
                    {r.ok ? <Badge tone="success">Complete</Badge> : r.finished_at ? <Badge tone="danger">Failed</Badge> : <Badge tone="information">Running</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title={`Unmapped channel (${unmapped.data?.length ?? 0}${(unmapped.data?.length ?? 0) === 50 ? "+" : ""})`} />
          <p className="px-4 pt-3 text-ds-text-subtle">The channel couldn’t be worked out from the channel name or the order ID.</p>
          <table className="ds-table mt-3">
            <thead><tr><th>Order ID</th><th>Channel Name</th></tr></thead>
            <tbody>
              {unmapped.data?.map((o) => (
                <tr key={o.order_code}>
                  <td className="font-mono text-[13px]">{o.order_code}</td>
                  <td className="text-ds-text-subtle">{o.channel_name ?? <Empty />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={`Linked shipments without original (${orphans.length})`} />
          <p className="px-4 pt-3 text-ds-text-subtle">Usually the original order is older than the data in DataBank.</p>
          <table className="ds-table mt-3">
            <thead><tr><th>Shipment</th><th>Points to</th></tr></thead>
            <tbody>
              {orphans.slice(0, 100).map((o) => (
                <tr key={o.order_code}>
                  <td className="font-mono text-[13px]">{o.order_code}</td>
                  <td className="font-mono text-[13px] text-ds-text-subtle">{o.base_order_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
