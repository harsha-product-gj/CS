"use client";

import { useActionState } from "react";
import { createUser, deleteUser, updateUser, type FormState } from "./actions";
import { Button, Label, inputCls } from "@/components/ui";

const ROLES = [
  { id: "agent", label: "Agent" },
  { id: "ops", label: "Ops" },
  { id: "admin", label: "Admin" },
];

function RoleBoxes({ selected = ["agent"] }: { selected?: string[] }) {
  return (
    <div className="flex gap-4 text-sm">
      {ROLES.map((r) => (
        <label key={r.id} className="flex items-center gap-1.5">
          <input type="checkbox" name={`role_${r.id}`} defaultChecked={selected.includes(r.id)} />
          {r.label}
        </label>
      ))}
    </div>
  );
}

function Msg({ s }: { s: FormState }) {
  if (s.error) return <p className="text-sm text-red-600">{s.error}</p>;
  if (s.ok) return <p className="text-sm text-emerald-700">{s.ok}</p>;
  return null;
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="username">Username</Label>
        <input id="username" name="username" required className={inputCls} placeholder="e.g. jhumi" />
      </div>
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <input id="full_name" name="full_name" required className={inputCls} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
      </div>
      <div>
        <Label>Roles</Label>
        <div className="pt-2"><RoleBoxes /></div>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create user"}</Button>
        <Msg s={state} />
      </div>
    </form>
  );
}

export function DeleteUserButton({ id, username }: { id: string; username: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteUser, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete user "${username}"? This can't be undone.`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Msg s={state} />
      <Button type="submit" variant="danger" disabled={pending} className="px-2 py-1 text-xs">
        {pending ? "Deleting…" : "Delete"}
      </Button>
    </form>
  );
}

export function EditUserForm({ user }: { user: { id: string; full_name: string; roles: string[]; active: boolean } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateUser, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <input type="hidden" name="id" value={user.id} />
      <div>
        <Label>Full name</Label>
        <input name="full_name" defaultValue={user.full_name} className={inputCls} />
      </div>
      <div className="pb-2"><RoleBoxes selected={user.roles} /></div>
      <label className="flex items-center gap-1.5 pb-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={user.active} /> Active
      </label>
      <div className="sm:col-span-2">
        <Label>Reset password (optional)</Label>
        <input name="password" type="password" autoComplete="new-password" className={inputCls} placeholder="Leave blank to keep" />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
      <div className="sm:col-span-3"><Msg s={state} /></div>
    </form>
  );
}
