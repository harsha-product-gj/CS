import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { searchCustomers, SEARCH_LIMIT } from "@/lib/orders/queries";
import { Badge, Button, Card } from "@/components/ui";
import { channelLabel, fmtDate } from "@/lib/format";

const MATCH_LABEL: Record<string, string> = {
  phone: "Mobile", order: "Order ID", awb: "AWB", name: "Name", ean: "ASIN / FSN", pincode: "Pincode",
};

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  await requireUser();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();

  if (!q) {
    return (
      <div className="py-16 text-center text-stone-500">
        <h1 className="mb-2 text-xl font-semibold text-stone-800">Find a customer</h1>
        <p className="text-sm">
          Search by mobile number, order ID, AWB / tracking number, customer name, ASIN / FSN, or a 6-digit pincode.
        </p>
      </div>
    );
  }

  if (q.length < 3) return <p className="text-sm text-stone-500">Type at least 3 characters.</p>;

  const { matches, truncated } = await searchCustomers(q);
  if (matches.length === 1) redirect(`/customers/${encodeURIComponent(matches[0].key)}?q=${encodeURIComponent(q)}`);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">
        {matches.length ? `${matches.length} customers match "${q}"` : `No orders found for "${q}"`}
      </h1>

      {truncated && (
        <p className="text-sm text-stone-500">
          Showing customers from the latest {SEARCH_LIMIT} matching orders. Add more detail to narrow it down.
        </p>
      )}

      {matches.length === 0 && (
        <Card className="p-5 text-sm text-stone-600">
          <p className="mb-3">
            Not in the order data. This is expected for Amazon FBA, Flipkart FBF and most RetailEZ orders, and for
            enquiries without an order.
          </p>
          <Button disabled title="Arrives with the Tickets module">Create ticket (coming next)</Button>
        </Card>
      )}

      {matches.length > 0 && (
        <Card className="divide-y divide-stone-100">
          {matches.map((m) => (
            <Link
              key={m.key}
              href={`/customers/${encodeURIComponent(m.key)}?q=${encodeURIComponent(q)}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-stone-50"
            >
              <span className="min-w-40 font-medium">{m.name ?? "Name not available"}</span>
              <span className="font-mono text-sm text-stone-600">{m.phone ?? "No mobile"}</span>
              <span className="text-sm text-stone-500">
                {m.orderCount} order{m.orderCount > 1 ? "s" : ""} · last {fmtDate(m.latest)}
              </span>
              <span className="flex gap-1">
                {m.channels.map((c) => (
                  <Badge key={c} tone="indigo">{channelLabel(c)}</Badge>
                ))}
              </span>
              <span className="ml-auto text-xs text-stone-400">matched on {MATCH_LABEL[m.matchedOn] ?? m.matchedOn}</span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
