import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { channelLabel, fmtDateTime } from "@/lib/format";

export default async function OrderDataPage() {
  await requireUser("admin");
  const client = db();

  const [runs, unmapped, linked, channelCounts] = await Promise.all([
    client.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(10),
    client.from("orders").select("order_code, channel_name, order_date").eq("order_channel", "UNMAPPED").order("order_date", { ascending: false }).limit(50),
    client.from("orders").select("order_code, base_order_code, link_type").not("base_order_code", "is", null).limit(2000),
    Promise.all(
      ["AS", "SX", "AR", "FS", "WD", "UNMAPPED"].map(async (ch) => {
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

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Order data</h1>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">Orders by channel</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          {channelCounts.map(([ch, n]) => (
            <div key={ch} className="rounded border border-stone-200 px-3 py-2">
              <div className="text-xs text-stone-500">{channelLabel(ch)}</div>
              <div className="font-semibold">{n.toLocaleString("en-IN")}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">Recent imports / syncs</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-stone-400">
            <tr><th className="py-1">Started</th><th>Source</th><th>Rows</th><th>Orders</th><th>Result</th></tr>
          </thead>
          <tbody>
            {runs.data?.map((r) => (
              <tr key={r.id} className="border-t border-stone-100">
                <td className="py-1.5">{fmtDateTime(r.started_at)}</td>
                <td>{r.source}</td>
                <td>{r.rows_read?.toLocaleString("en-IN")}</td>
                <td>{r.orders_upserted?.toLocaleString("en-IN") ?? "—"}</td>
                <td>{r.ok ? <Badge tone="green">ok</Badge> : r.finished_at ? <Badge tone="red">failed</Badge> : <Badge tone="amber">running</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 font-medium">Unmapped channel ({unmapped.data?.length ?? 0}{(unmapped.data?.length ?? 0) === 50 ? "+" : ""})</h2>
        <p className="mb-3 text-sm text-stone-500">Orders whose channel couldn’t be worked out from the channel name or order ID.</p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {unmapped.data?.map((o) => (
            <li key={o.order_code} className="font-mono text-xs">{o.order_code} <span className="text-stone-400">· {o.channel_name}</span></li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 font-medium">Linked shipments without original order ({orphans.length})</h2>
        <p className="mb-3 text-sm text-stone-500">Usually the original is older than the data in DataBank.</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {orphans.slice(0, 100).map((o) => (
            <li key={o.order_code} className="font-mono text-xs">{o.order_code} <span className="text-stone-400">→ {o.base_order_code}</span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
