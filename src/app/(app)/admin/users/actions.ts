"use server";

import { revalidatePath } from "next/cache";
import { requireUser, type Role } from "@/lib/auth";
import { db, usernameToEmail } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

const ROLES: Role[] = ["agent", "ops", "admin"];
const rolesFrom = (form: FormData) => ROLES.filter((r) => form.get(`role_${r}`) === "on");

async function audit(by: string, entityId: string, action: string, changes: object) {
  await db().from("audit_log").insert({ entity: "user", entity_id: entityId, action, changed_by: by, changes });
}

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser("admin");
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const fullName = String(form.get("full_name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const roles = rolesFrom(form);

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return { error: "Username: 3–32 chars, lowercase letters, numbers, . _ -" };
  if (!fullName) return { error: "Full name is required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!roles.length) return { error: "Pick at least one role." };

  const { data, error } = await db().auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  });
  if (error || !data.user) {
    return { error: /already/i.test(error?.message ?? "") ? "That username is taken." : `Could not create user: ${error?.message}` };
  }
  const { error: pErr } = await db().from("profiles").insert({ id: data.user.id, username, full_name: fullName, roles });
  if (pErr) {
    await db().auth.admin.deleteUser(data.user.id);
    return { error: `Could not create profile: ${pErr.message}` };
  }
  await audit(admin.id, data.user.id, "create", { username, full_name: fullName, roles });
  revalidatePath("/admin/users");
  return { ok: `Created ${username}.` };
}

export async function updateUser(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser("admin");
  const id = String(form.get("id"));
  const fullName = String(form.get("full_name") ?? "").trim();
  const roles = rolesFrom(form);
  const active = form.get("active") === "on";
  const password = String(form.get("password") ?? "");

  if (!fullName) return { error: "Full name is required." };
  if (!roles.length) return { error: "Pick at least one role." };
  if (id === admin.id && (!roles.includes("admin") || !active)) return { error: "You can't remove your own admin access." };
  if (password && password.length < 8) return { error: "New password must be at least 8 characters." };

  const { data: before } = await db().from("profiles").select("full_name, roles, active").eq("id", id).single();
  const { error } = await db().from("profiles").update({ full_name: fullName, roles, active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  if (password) {
    const { error: pwErr } = await db().auth.admin.updateUserById(id, { password });
    if (pwErr) return { error: `Saved, but password reset failed: ${pwErr.message}` };
  }
  await audit(admin.id, id, "update", { before, after: { full_name: fullName, roles, active }, password_reset: !!password });
  revalidatePath("/admin/users");
  return { ok: password ? "Saved and password reset." : "Saved." };
}
