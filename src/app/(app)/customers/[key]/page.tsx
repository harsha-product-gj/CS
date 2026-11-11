import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCustomer, type Item, type Order } from "@/lib/orders/queries";
import { Badge, Button, Card } from "@/components/ui";
import { channelLabel, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";

function statusTone(s?: string | null) {
  if (!s) return "stone" as const;
  if (/CANCEL|RTO|RETURN/i.test(s)) return "red" as const;
  if (/DELIVERED|COMPLETE/i.test(s)) return "green" as const;
  return "amber" as const;
}

function Items({ items }: { items: Item[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-stone-400">
          <tr>
            <th className="py-1 pr-3 font-medium">Item</th>
            <th className="py-1 pr-3 font-medium">Status</th>
            <th className="py-1 pr-3 font-medium">AWB</th>
            <th className="py-1 pr-3 font-medium">Dispatched</th>
            <th className="py-1 pr-3 font-medium">Delivered</th>
            <th className="py-1 text-right font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.sku} className="border-t border-stone-100 align-top">
              <td className="py-1.5 pr-3">
                <div>{i.item_name ?? i.sku}</div>
                <div className="font-mono text-xs text-stone-400">{i.sku}</div>
              </td>
              <td className="py-1.5 pr-3">
                <div className="flex flex-col items-start gap-1">
                  <Badge tone={statusTone(i.sale_order_status)}>{i.sale_order_status ?? "—"}</Badge>
                  {i.courier_status && <Badge tone={statusTone(i.courier_status)}>{i.courier_status}</Badge>}
                </div>
              </td>
              <td className="py-1.5 pr-3">
                <div className="font-mono text-xs">{i.tracking_number ?? "—"}</div>
                <div className="text-xs text-stone-400">{i.shipping_provider}</div>
              </td>
              <td className="py-1.5 pr-3 text-xs">{fmtDateTime(i.dispatch_date)}</td>
              <td className="py-1.5 pr-3 text-xs">{fmtDateTime(i.delivery_time)}</td>
              <td className="py-1.5 text-right">{fmtMoney(i.selling_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderHeader({ o }: { o: Order }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm font-semibold">{o.order_code}</span>
      <Badge tone="indigo">{channelLabel(o.order_channel)}</Badge>
      {o.link_type && <Badge tone="amber">{o.link_type}</Badge>}
      <span className="text-sm text-stone-500">{fmtDateTime(o.order_date)}</span>
      <span className="ml-auto text-sm font-medium">{fmtMoney(o.total_price)}</span>
    </div>
  );
}

export default async function CustomerPage({ params }: PageProps<"/customers/[key]">) {
  await requireUser();
  const { key } = await params;
  const c = await getCustomer(decodeURIComponent(key));
  if (!c) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400">Customer</p>
          <h1 className="text-lg font-semibold">{c.name ?? "Name not available"}</h1>
          <p className="font-mono text-sm text-stone-700">{c.phones.join(", ") || "No mobile in order data"}</p>
          {c.addresses.length > 0 && (
            <div className="mt-3 space-y-2 text-sm text-stone-600">
              {c.addresses.slice(0, 3).map((a) => (
                <p key={a}>{a}</p>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-stone-400">
            {c.orders.length} order{c.orders.length === 1 ? "" : "s"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-stone-400">Tickets</p>
          <p className="mb-3 text-sm text-stone-500">No tickets yet.</p>
          <Button disabled className="w-full" title="Arrives with the Tickets module">
            Create ticket (coming next)
          </Button>
        </Card>
      </aside>

      <div className="space-y-4">
        {c.orders.map((o) => (
          <Card key={o.order_code} className="p-4">
            <OrderHeader o={o} />
            <div className="mt-3">
              <Items items={o.items} />
            </div>
            {o.linked.length > 0 && (
              <div className="mt-4 space-y-3 border-l-2 border-amber-200 pl-4">
                <p className="text-xs uppercase tracking-wide text-stone-400">Linked shipments</p>
                {o.linked.map((l) => (
                  <div key={l.order_code}>
                    <OrderHeader o={l} />
                    <div className="mt-2">
                      <Items items={l.items} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 border-t border-stone-100 pt-2 text-xs text-stone-400">
              Tickets on this order: none · Delivered {fmtDate(o.items.find((i) => i.delivery_time)?.delivery_time)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
