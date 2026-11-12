import "server-only";
import { db } from "@/lib/supabase/server";

export type Order = {
  order_code: string;
  base_order_code: string | null;
  link_type: string | null;
  channel_name: string | null;
  order_channel: string;
  order_date: string | null;
  customer_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  total_price: number | null;
  item_count: number;
  status: string | null;
};

export type Item = {
  order_code: string;
  sku: string;
  item_name: string | null;
  color: string | null;
  ean: string | null;
  facility: string | null;
  package_code: string | null;
  sale_order_status: string | null;
  tracking_number: string | null;
  dispatch_date: string | null;
  delivery_time: string | null;
  shipping_provider: string | null;
  selling_price: number | null;
  courier_status: string | null;
};

export type OrderWithItems = Order & { items: Item[]; linked: (Order & { items: Item[] })[] };

export type CustomerMatch = {
  key: string;
  name: string | null;
  phone: string | null;
  orderCount: number;
  latest: string | null;
  channels: string[];
  matchedOn: string;
};

const ORDER_COLS =
  "order_code, base_order_code, link_type, channel_name, order_channel, order_date, customer_name, phone, address_line1, address_line2, pincode, city, state, total_price, item_count, status";
const ITEM_COLS =
  "order_code, sku, item_name, color, ean, facility, package_code, sale_order_status, tracking_number, dispatch_date, delivery_time, shipping_provider, selling_price, courier_status";

/** A customer is identified by phone; orders without a phone stand alone (keyed by original order). */
export const customerKey = (o: Pick<Order, "phone" | "order_code" | "base_order_code">) =>
  o.phone ? `p-${o.phone}` : `o-${o.base_order_code ?? o.order_code}`;

export const SEARCH_LIMIT = 100;

/** Customers matching the search, newest first. "truncated" = more orders matched than were fetched. */
export async function searchCustomers(q: string): Promise<{ matches: CustomerMatch[]; truncated: boolean }> {
  const { data: hits, error } = await db().rpc("search_orders", { q, max_rows: SEARCH_LIMIT });
  if (error) throw error;
  if (!hits?.length) return { matches: [], truncated: false };
  const matchedOn = new Map<string, string>(hits.map((h: { order_code: string; matched_on: string }) => [h.order_code, h.matched_on]));
  const { data: orders, error: e2 } = await db().from("orders").select(ORDER_COLS).in("order_code", [...matchedOn.keys()]);
  if (e2) throw e2;

  const groups = new Map<string, CustomerMatch>();
  for (const o of (orders ?? []) as Order[]) {
    const key = customerKey(o);
    const g = groups.get(key) ?? {
      key, name: o.customer_name, phone: o.phone, orderCount: 0, latest: null, channels: [], matchedOn: matchedOn.get(o.order_code) ?? "",
    };
    g.orderCount++;
    if (!g.latest || (o.order_date && o.order_date > g.latest)) {
      g.latest = o.order_date;
      g.name = o.customer_name ?? g.name;
    }
    if (!g.channels.includes(o.order_channel)) g.channels.push(o.order_channel);
    groups.set(key, g);
  }
  return {
    matches: [...groups.values()].sort((a, b) => (b.latest ?? "").localeCompare(a.latest ?? "")),
    truncated: hits.length >= SEARCH_LIMIT,
  };
}

async function fetchOrders(filter: { column: string; values: string[] }): Promise<Order[]> {
  if (!filter.values.length) return [];
  const { data, error } = await db().from("orders").select(ORDER_COLS).in(filter.column, filter.values).limit(500);
  if (error) throw error;
  return (data ?? []) as Order[];
}

/** Everything known about one customer: their orders (newest first) with items and linked shipments. */
export async function getCustomer(key: string) {
  const [kind, ...rest] = key.split("-");
  const id = decodeURIComponent(rest.join("-"));
  let orders: Order[] = [];

  if (kind === "p") {
    orders = await db()
      .from("orders").select(ORDER_COLS).eq("phone", id).limit(500)
      .then(({ data, error }) => { if (error) throw error; return (data ?? []) as Order[]; });
  } else if (kind === "o") {
    orders = await fetchOrders({ column: "order_code", values: [id] });
  } else {
    return null;
  }

  // Pull in originals of linked shipments and linked shipments of originals.
  const have = new Set(orders.map((o) => o.order_code));
  const missingBases = [...new Set(orders.map((o) => o.base_order_code).filter((b): b is string => !!b && !have.has(b)))];
  orders.push(...(await fetchOrders({ column: "order_code", values: missingBases })));
  orders.forEach((o) => have.add(o.order_code));
  const roots = orders.filter((o) => !o.base_order_code || !have.has(o.base_order_code)).map((o) => o.order_code);
  const children = await fetchOrders({ column: "base_order_code", values: roots });
  for (const c of children) if (!have.has(c.order_code)) { orders.push(c); have.add(c.order_code); }
  if (!orders.length) return null;

  const { data: items, error } = await db().from("order_items").select(ITEM_COLS).in("order_code", [...have]);
  if (error) throw error;
  const itemsBy = new Map<string, Item[]>();
  for (const i of (items ?? []) as Item[]) itemsBy.set(i.order_code, [...(itemsBy.get(i.order_code) ?? []), i]);

  const byDate = (a: Order, b: Order) => (b.order_date ?? "").localeCompare(a.order_date ?? "");
  const tree: OrderWithItems[] = orders
    .filter((o) => !o.base_order_code || !have.has(o.base_order_code))
    .sort(byDate)
    .map((o) => ({
      ...o,
      items: itemsBy.get(o.order_code) ?? [],
      linked: orders
        .filter((c) => c.base_order_code === o.order_code)
        .sort(byDate)
        .map((c) => ({ ...c, items: itemsBy.get(c.order_code) ?? [] })),
    }));

  const latest = [...orders].sort(byDate)[0];
  const phones = [...new Set(orders.map((o) => o.phone).filter(Boolean))] as string[];
  const addresses = [
    ...new Map(
      orders
        .filter((o) => o.address_line1 || o.city)
        .sort(byDate)
        .map((o) => {
          const a = [o.address_line1, o.address_line2, o.city, o.state, o.pincode].filter(Boolean).join(", ");
          return [a.toLowerCase(), a] as const;
        }),
    ).values(),
  ];
  return {
    key,
    name: orders.sort(byDate).find((o) => o.customer_name)?.customer_name ?? null,
    phones,
    addresses,
    latestOrder: latest.order_code,
    orders: tree,
  };
}
