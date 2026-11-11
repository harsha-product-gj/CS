"use server";

import { redirect } from "next/navigation";
import { createAuthClient, db, usernameToEmail } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error || !data.user) return { error: "Wrong username or password." };

  const { data: p } = await db().from("profiles").select("active").eq("id", data.user.id).maybeSingle();
  if (!p?.active) {
    await supabase.auth.signOut();
    return { error: "This account is inactive. Contact an admin." };
  }
  redirect("/search");
}

export async function logout() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
