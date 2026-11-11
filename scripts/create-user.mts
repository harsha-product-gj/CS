// Creates an app user from the terminal (use it for the first admin).
// Usage: npm run user:create
import readline from "node:readline";
import { Writable } from "node:stream";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || url.includes("YOUR-")) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const domain = process.env.LOGIN_EMAIL_DOMAIN || "users.sleepyhug.local";

let muted = false;
const out = new Writable({ write(chunk, enc, cb) { if (!muted) process.stdout.write(chunk, enc); cb(); } });
const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
const ask = (q: string, hidden = false) =>
  new Promise<string>((res) => {
    process.stdout.write(q);
    muted = hidden;
    rl.question("", (a) => { muted = false; if (hidden) process.stdout.write("\n"); res(a.trim()); });
  });

const username = (await ask("Username: ")).toLowerCase();
const fullName = await ask("Full name: ");
const roles = ((await ask("Roles (comma separated: agent,ops,admin) [admin]: ")) || "admin").split(",").map((r) => r.trim());
const password = await ask("Password (min 8 chars, hidden): ", true);
rl.close();

if (!/^[a-z0-9._-]{3,32}$/.test(username) || !fullName || password.length < 8) {
  console.error("Invalid input.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.createUser({ email: `${username}@${domain}`, password, email_confirm: true });
if (error || !data.user) {
  console.error("Could not create auth user:", error?.message);
  process.exit(1);
}
const { error: pErr } = await sb.from("profiles").insert({ id: data.user.id, username, full_name: fullName, roles });
if (pErr) {
  await sb.auth.admin.deleteUser(data.user.id);
  console.error("Could not create profile:", pErr.message);
  process.exit(1);
}
console.log(`Created ${username} (${roles.join(", ")}). Sign in with this username.`);
