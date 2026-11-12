// Creates an app user from the terminal (use it for the first admin).
// Usage: npm run user:create
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || url.includes("YOUR-")) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const domain = process.env.LOGIN_EMAIL_DOMAIN || "users.sleepyhug.local";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let masking = false;
// Hide typed characters while asking for the password (the prompt itself is shown).
const rlAny = rl as unknown as { _writeToOutput: (s: string) => void };
const origWrite = rlAny._writeToOutput.bind(rl);
rlAny._writeToOutput = (s: string) => {
  if (!masking) return origWrite(s);
  if (/[\r\n]/.test(s)) origWrite("\n");
};
// Queue lines so pasted or piped input isn't lost between prompts.
const queued: string[] = [];
const waiting: ((l: string) => void)[] = [];
rl.on("line", (l) => (waiting.length ? waiting.shift()!(l) : queued.push(l)));
const nextLine = () => new Promise<string>((res) => (queued.length ? res(queued.shift()!) : waiting.push(res)));
const ask = async (q: string) => {
  rl.setPrompt(q);
  rl.prompt();
  return (await nextLine()).trim();
};
const askHidden = async (q: string) => {
  rl.setPrompt(q);
  rl.prompt();
  masking = true;
  const a = await nextLine();
  masking = false;
  return a;
};

console.log("Create a SleepyHug CS user\n");
const username = (await ask("Username (e.g. harsha): ")).toLowerCase();
const fullName = await ask("Full name: ");
const rolesIn = (await ask("Roles - agent, ops, admin (comma separated) [admin]: ")) || "admin";
const roles = rolesIn.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
const password = await askHidden("Password (min 8 characters): ");
const confirm = await askHidden("Repeat password: ");
rl.close();

const problems: string[] = [];
if (!/^[a-z0-9._-]{3,32}$/.test(username)) problems.push("Username must be 3-32 characters: lowercase letters, numbers, . _ -");
if (!fullName) problems.push("Full name is required.");
if (!roles.length || roles.some((r) => !["agent", "ops", "admin"].includes(r))) problems.push("Roles must be agent, ops and/or admin.");
if (password.length < 8) problems.push("Password must be at least 8 characters.");
if (password !== confirm) problems.push("Passwords don't match.");
if (problems.length) {
  console.error("\n" + problems.map((p) => "x " + p).join("\n"));
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.createUser({ email: `${username}@${domain}`, password, email_confirm: true });
if (error || !data.user) {
  console.error(/already/i.test(error?.message ?? "") ? "\nThat username already exists." : `\nCould not create user: ${error?.message}`);
  process.exit(1);
}
const { error: pErr } = await sb.from("profiles").insert({ id: data.user.id, username, full_name: fullName, roles });
if (pErr) {
  await sb.auth.admin.deleteUser(data.user.id);
  console.error("\nCould not create profile:", pErr.message);
  process.exit(1);
}
console.log(`\nCreated ${username} (${roles.join(", ")}). Sign in with this username.`);
