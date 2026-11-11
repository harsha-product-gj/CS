// Applies supabase/migrations/*.sql in order, once each.
// Usage: npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import { connect } from "./db.mts";

const dir = path.resolve("supabase/migrations");
const client = connect();
await client.connect();
await client.query(`create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())`);
await client.query(`alter table public._migrations enable row level security`);
const done = new Set((await client.query("select name from public._migrations")).rows.map((r) => r.name));

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  const sql = fs.readFileSync(path.join(dir, file), "utf8");
  process.stdout.write(`Applying ${file} ... `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public._migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log("ok");
  } catch (e) {
    await client.query("rollback");
    console.log("FAILED");
    console.error(e);
    process.exit(1);
  }
}
console.log("Migrations up to date.");
await client.end();
