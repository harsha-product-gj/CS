import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Phone, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCustomer, type Item, type Order, type OrderWithItems } from "@/lib/orders/queries";
import { Badge, Button, Card, Empty } from "@/components/ui";
import { channelLabel, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";

function statusTone(s?: string | null) {
  if (!s) return "neutral" as const;
  if (/CANCEL|RTO|RETURN|LOST|DAMAGE/i.test(s)) return "danger" as const;
  if (/DELIVERED|COMPLETE/i.test(s)) return "success" as const;
  if (/PROCESS|PENDING|MANIFEST|TRANSIT|PICK/i.test(s)) return "information" as const;
  return "warning" as const;
}

function Items({ items }: { items: Item[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="ds-table min-w-[600px]">
        <thead>
          <tr>
            <th>Item</th>
            <th>Status</th>
            <th>AWB</th>
            <th>Dispatched</th>
            <th>Delivered</th>
            <th className="ds-num">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.sku}>
              <td>
                <div>{i.item_name ?? i.sku}</div>
                <div className="font-mono text-xs text-ds-text-subtlest">
                  {i.sku}
                  {i.ean && <> · {i.ean}</>}
                </div>
              </td>
              <td>
                <div className="flex flex-col items-start gap-1">
                  <Badge tone={statusTone(i.sale_order_status)}>{i.sale_order_status ?? "—"}</Badge>
                  {i.courier_status && <Badge tone={statusTone(i.courier_status)}>{i.courier_status}</Badge>}
                </div>
              </td>
              <td>
                <div className="font-mono text-[13px]">{i.tracking_number ?? <Empty />}</div>
                <div className="text-xs text-ds-text-subtlest">{i.shipping_provider}</div>
              </td>
              <td className="whitespace-nowrap">{i.dispatch_date ? fmtDateTime(i.dispatch_date) : <Empty />}</td>
              <td className="whitespace-nowrap">{i.delivery_time ? fmtDateTime(i.delivery_time) : <Empty />}</td>
              <td className="ds-num">{fmtMoney(i.selling_price)}</td>
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
      <span className="font-mono text-[13px] font-semibold">{o.order_code}</span>
      <Badge tone="information">{channelLabel(o.order_channel)}</Badge>
      {o.link_type && <Badge tone="discovery">{o.link_type}</Badge>}
      <span className="text-ds-text-subtle">{fmtDateTime(o.order_date)}</span>
      <span className="ml-auto font-semibold">{fmtMoney(o.total_price)}</span>
    </div>
  );
}

/** True when the search text points at this order specifically (order ID, AWB or EAN), not just the customer. */
function matchesSearch(o: Order & { items: Item[] }, q: string) {
  const v = q.trim().toLowerCase();
  if (!v) return false;
  return (
    o.order_code.toLowerCase() === v ||
    o.items.some((i) => i.tracking_number?.toLowerCase() === v || i.ean?.toLowerCase() === v)
  );
}
const groupMatches = (o: OrderWithItems, q: string) => matchesSearch(o, q) || o.linked.some((l) => matchesSearch(l, q));

export default async function CustomerPage({ params, searchParams }: PageProps<"/customers/[key]">) {
  await requireUser();
  const { key } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const c = await getCustomer(decodeURIComponent(key));
  if (!c) notFound();
  // Orders the search pointed at come first and are highlighted; the customer's other orders follow.
  const orders = [...c.orders].sort((a, b) => Number(groupMatches(b, q)) - Number(groupMatches(a, q)));
  const matchedCount = orders.filter((o) => groupMatches(o, q)).length;

  return (
    <>
      {q && (
        <Link href={`/search?q=${encodeURIComponent(q)}`} className="mb-3 inline-flex items-center gap-1 text-ds-link hover:underline">
          <ChevronLeft size={16} aria-hidden /> Search results
        </Link>
      )}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <p className="ds-heading-xxsmall text-ds-text-subtlest uppercase">Customer</p>
          <h1 className="ds-heading-large">{c.name ?? "Name not available"}</h1>
        </div>
        <div className="ml-auto">
          <Button appearance="primary" disabled title="Arrives with the Tickets module">
            <Ticket size={16} aria-hidden /> Create ticket
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="ds-heading-xsmall mb-3">Contact</h2>
            <div className="flex items-start gap-2">
              <Phone size={16} className="mt-0.5 shrink-0 text-ds-icon-subtle" aria-hidden />
              <span className="font-mono text-[13px]">{c.phones.length ? c.phones.map((p) => `+91 ${p}`).join(", ") : <Empty />}</span>
            </div>
            {c.addresses.slice(0, 3).map((a) => (
              <div key={a} className="mt-3 flex items-start gap-2 text-ds-text-subtle">
                <MapPin size={16} className="mt-0.5 shrink-0 text-ds-icon-subtle" aria-hidden />
                <span>{a}</span>
              </div>
            ))}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-ds-border pt-3">
              <div>
                <p className="ds-body-small text-ds-text-subtle">Orders</p>
                <p className="ds-heading-small">{c.orders.length}</p>
              </div>
              <div>
                <p className="ds-body-small text-ds-text-subtle">Tickets</p>
                <p className="ds-heading-small">0</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="ds-heading-xsmall mb-1">Tickets</h2>
            <p className="text-ds-text-subtle">No tickets yet. Ticketing arrives in the next module.</p>
          </Card>
        </aside>

        <div className="min-w-0 space-y-4">
          {matchedCount > 0 && c.orders.length > matchedCount && (
            <p className="text-ds-text-subtle">
              Showing the order you searched for first, then this customer’s {c.orders.length - matchedCount} other order
              {c.orders.length - matchedCount === 1 ? "" : "s"}.
            </p>
          )}
          {orders.map((o) => {
            const hit = groupMatches(o, q);
            return (
              <Card key={o.order_code} className={`overflow-hidden ${hit ? "border-ds-border-selected ring-1 ring-ds-border-selected" : ""}`}>
                <div className={`px-4 py-3 ${hit ? "bg-ds-background-selected" : ""}`}>
                  {hit && <p className="ds-heading-xxsmall mb-1 text-ds-text-selected uppercase">Searched order</p>}
                  <OrderHeader o={o} />
                </div>
                <Items items={o.items} />
                {o.linked.length > 0 && (
                  <div className="border-t border-ds-border bg-ds-surface-sunken px-4 py-3">
                    <p className="ds-heading-xxsmall mb-2 text-ds-text-subtle uppercase">Linked shipments</p>
                    <div className="space-y-3">
                      {o.linked.map((l) => (
                        <div key={l.order_code} className="overflow-hidden rounded-ds-small border border-ds-border bg-ds-surface">
                          <div className="px-3 py-2">
                            <OrderHeader o={l} />
                          </div>
                          <Items items={l.items} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 border-t border-ds-border px-4 py-2 text-xs text-ds-text-subtle">
                  <span>Tickets on this order: none</span>
                  <span>Delivered {fmtDate(o.items.find((i) => i.delivery_time)?.delivery_time)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
