"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Button, Label } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="username">Username</Label>
        <input id="username" name="username" autoComplete="username" autoFocus required className="ds-input" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="ds-input" />
      </div>
      {state.error && (
        <p role="alert" className="rounded-ds-medium bg-ds-background-danger px-3 py-2 text-ds-text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" appearance="primary" disabled={pending} className="h-10 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
