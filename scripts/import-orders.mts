// Imports a DataBank "Sale Orders" CSV export into orders + order_items.
// Usage: npm run import:orders -- "data/DataBank - Sale Orders.csv" [--dry-run]
import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { connect } from "./db.mts";
import {
  buildOrder, resolveLinks, isExcludedOrder, ORDER_CHANNELS,
  type SheetRow, type OrderRecord, type ItemRecord,
} from "../src/lib/orders/transform.ts";

const file = process.argv.find((a) => a.endsWith(".csv"));
const dry = process.argv.includes("--dry-run");
if (!file) {
  console.error("Pass the CSV path.");
  process.exit(1);
}

const rows: SheetRow[] = parse(fs.readFileSync(file), { columns: true, skip_empty_lines: true, bom: true });
const groups = new Map<string, SheetRow[]>();
let skipped = 0;
for (const r of rows) {
  const code = (r["Display Order Code"] ?? "").trim();
  if (!code || isExcludedOrder(code)) { skipped++; continue; }
  if (!groups.has(code)) groups.set(code, []);
  groups.get(code)!.push(r);
}

const orders = new Map<string, OrderRecord>();
const items: ItemRecord[] = [];
const soft = new Set<string>();
for (const [code, g] of groups) {
  const b = buildOrder(g);
  orders.set(code, b.order);
  items.push(...b.items);
  if (b.softLink) soft.add(code);
}
resolveLinks(orders, soft);

// ---- stats
const byChannel = new Map<string, number>();
let linked = 0, unresolved = 0, noPhone = 0;
const unresolvedEx: string[] = [];
const unmappedNames = new Map<string, number>();
for (const o of orders.values()) {
  byChannel.set(o.order_channel, (byChannel.get(o.order_channel) ?? 0) + 1);
  if (o.base_order_code) {
    linked++;
    if (!orders.has(o.base_order_code)) { unresolved++; if (unresolvedEx.length < 8) unresolvedEx.push(o.order_code); }
  }
  if (!o.phone) noPhone++;
  if (o.order_channel === "UNMAPPED") unmappedNames.set(`${o.channel_name} ${o.order_code}`, 1);
}
console.log(`Rows read: ${rows.length}  skipped (test/sample/blank): ${skipped}`);
console.log(`Orders: ${orders.size}  items: ${items.length}  without usable phone: ${noPhone}`);
console.log(`Linked shipments: ${linked}  (original not found: ${unresolved}) e.g. ${unresolvedEx.join(", ")}`);
console.log("By channel:", Object.fromEntries([...byChannel].map(([k, v]) => [`${k} ${ORDER_CHANNELS[k as keyof typeof ORDER_CHANNELS]}`, v])));
if (unmappedNames.size) console.log("Unmapped examples:", [...unmappedNames.keys()].slice(0, 15));
if (dry) process.exit(0);

// ---- write
const client = connect();
await client.connect();
const run = await client.query("insert into sync_runs (source, rows_read) values ('csv-import', $1) returning id", [rows.length]);
const runId = run.rows[0].id;

const orderCols = Object.keys([...orders.values()][0]).filter((c) => c !== "order_code");
const itemCols = Object.keys(items[0]).filter((c) => c !== "order_code" && c !== "sku");
const BATCH = 2000;
async function upsert(table: string, data: object[], key: string, cols: string[]) {
  for (let i = 0; i < data.length; i += BATCH) {
    const chunk = data.slice(i, i + BATCH);
    await client.query(
      `insert into ${table} select * from jsonb_populate_recordset(null::${table}, $1::jsonb)
       on conflict (${key}) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}${table === "orders" ? ", synced_at = now()" : ""}`,
      [JSON.stringify(chunk)],
    );
    process.stdout.write(`\r${table}: ${Math.min(i + BATCH, data.length)}/${data.length}`);
  }
  console.log();
}
try {
  await upsert("orders", [...orders.values()].map((o) => ({ ...o, synced_at: new Date().toISOString() })), "order_code", orderCols);
  await upsert("order_items", items, "order_code, sku", itemCols);
  await client.query(
    "update sync_runs set finished_at = now(), ok = true, orders_upserted = $2, items_upserted = $3, rows_skipped = $4 where id = $1",
    [runId, orders.size, items.length, skipped],
  );
  console.log("Import complete.");
} catch (e) {
  await client.query("update sync_runs set finished_at = now(), ok = false, notes = $2 where id = $1", [runId, String(e)]);
  throw e;
} finally {
  await client.end();
}
