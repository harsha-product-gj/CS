import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageSearch, SearchX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { searchCustomers, SEARCH_LIMIT } from "@/lib/orders/queries";
import { Badge, Button, Card, Empty, EmptyState, PageHeader } from "@/components/ui";
import { channelLabel, fmtDate } from "@/lib/format";

const MATCH_LABEL: Record<string, string> = {
  phone: "Mobile", order: "Order ID", awb: "AWB", name: "Name", ean: "ASIN / FSN", pincode: "Pincode",
};

const TIPS = [
  ["Mobile", "98765 43210, +91 98765 43210"],
  ["Order ID", "OD438900466853295100, 404-0374026-5422716"],
  ["AWB", "33179410692215"],
  ["Name", "Rajiv Gupta"],
  ["ASIN / FSN", "B0CQ59BQX7"],
  ["Pincode", "226020"],
];

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  await requireUser();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();

  if (!q) {
    return (
      <>
        <PageHeader title="Customer search" description="Find a customer to see their orders and tickets." />
        <Card>
          <EmptyState icon={<PackageSearch size={40} strokeWidth={1.5} />} title="Search from the bar above">
            Paste whatever the customer gave you. One match opens the customer straight away.
          </EmptyState>
          <div className="border-t border-ds-border px-4 py-3">
            <p className="ds-heading-xxsmall mb-2 text-ds-text-subtle">You can search by</p>
            <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {TIPS.map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-24 shrink-0 text-ds-text-subtle">{k}</dt>
                  <dd className="font-mono text-[13px] text-ds-text">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </>
    );
  }

  if (q.length < 3) {
    return <PageHeader title="Customer search" description="Type at least 3 characters." />;
  }

  const { matches, truncated } = await searchCustomers(q);
  if (matches.length === 1) redirect(`/customers/${encodeURIComponent(matches[0].key)}?q=${encodeURIComponent(q)}`);

  if (!matches.length) {
    return (
      <>
        <PageHeader title="Customer search" />
        <Card>
          <EmptyState icon={<SearchX size={40} strokeWidth={1.5} />} title={`No orders found for “${q}”`}>
            <p>
              That’s expected for Amazon FBA, Flipkart FBF and most RetailEZ orders, and for enquiries without an order.
              You’ll be able to create a ticket with the customer’s details by hand.
            </p>
            <Button disabled className="mt-4" title="Arrives with the Tickets module">
              Create ticket (coming next)
            </Button>
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Customer search"
        description={
          <>
            {matches.length} customer{matches.length === 1 ? "" : "s"} match <span className="font-medium text-ds-text">“{q}”</span>
            {truncated && <> · showing the latest {SEARCH_LIMIT} matching orders</>}
          </>
        }
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ds-table min-w-[720px]">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Contact Number</th>
                <th className="ds-num">Orders</th>
                <th>Last Order</th>
                <th>Channel</th>
                <th>Matched On</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => {
                const href = `/customers/${encodeURIComponent(m.key)}?q=${encodeURIComponent(q)}`;
                return (
                  <tr key={m.key}>
                    <td>
                      <Link href={href} className="ds-focus font-medium text-ds-link hover:underline">
                        {m.name ?? "Name not available"}
                      </Link>
                    </td>
                    <td className="font-mono text-[13px]">{m.phone ?? <Empty />}</td>
                    <td className="ds-num">{m.orderCount}</td>
                    <td>{fmtDate(m.latest)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {m.channels.map((c) => (
                          <Badge key={c}>{channelLabel(c)}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="text-ds-text-subtle">{MATCH_LABEL[m.matchedOn] ?? m.matchedOn}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
