import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAuthClient, db } from "@/lib/supabase/server";

export type Role = "agent" | "ops" | "admin";
export type CurrentUser = { id: string; username: string; fullName: string; roles: Role[] };

/** The signed-in, active staff member, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await db()
    .from("profiles")
    .select("id, username, full_name, roles, active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!p || !p.active) return null;
  return { id: p.id, username: p.username, fullName: p.full_name, roles: p.roles as Role[] };
});

export async function requireUser(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && !user.roles.includes(role) && !user.roles.includes("admin")) redirect("/");
  return user;
}
