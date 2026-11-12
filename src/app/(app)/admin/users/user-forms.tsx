"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { createUser, deleteUser, updateUser, type FormState } from "./actions";
import { Button, Label } from "@/components/ui";

const ROLES = [
  { id: "agent", label: "Agent" },
  { id: "ops", label: "Ops" },
  { id: "admin", label: "Admin" },
];

function RoleBoxes({ selected = ["agent"] }: { selected?: string[] }) {
  return (
    <div className="flex h-10 items-center gap-4">
      {ROLES.map((r) => (
        <label key={r.id} className="flex items-center gap-1.5">
          <input type="checkbox" name={`role_${r.id}`} defaultChecked={selected.includes(r.id)} className="h-4 w-4 accent-[var(--ds-background-brand-bold)]" />
          {r.label}
        </label>
      ))}
    </div>
  );
}

function Msg({ s }: { s: FormState }) {
  if (s.error) return <p role="alert" className="text-ds-text-danger">{s.error}</p>;
  if (s.ok) return <p role="status" className="text-ds-text-success">{s.ok}</p>;
  return null;
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <Label htmlFor="username">Username</Label>
        <input id="username" name="username" required className="ds-input" placeholder="e.g. jhumi" />
      </div>
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <input id="full_name" name="full_name" required className="ds-input" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="ds-input" />
      </div>
      <div>
        <Label>Roles</Label>
        <RoleBoxes />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <Button type="submit" appearance="primary" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
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
      className="flex items-center gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <Msg s={state} />
      <Button type="submit" appearance="subtle" disabled={pending} className="text-ds-text-danger">
        <Trash2 size={16} aria-hidden /> {pending ? "Deleting…" : "Delete user"}
      </Button>
    </form>
  );
}

export function EditUserForm({ user }: { user: { id: string; full_name: string; roles: string[]; active: boolean } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateUser, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="id" value={user.id} />
      <div>
        <Label>Full name</Label>
        <input name="full_name" defaultValue={user.full_name} className="ds-input" />
      </div>
      <div>
        <Label>Roles</Label>
        <RoleBoxes selected={user.roles} />
      </div>
      <div>
        <Label>Status</Label>
        <label className="flex h-10 items-center gap-1.5">
          <input type="checkbox" name="active" defaultChecked={user.active} className="h-4 w-4 accent-[var(--ds-background-brand-bold)]" /> Active
        </label>
      </div>
      <div>
        <Label>Reset password</Label>
        <input name="password" type="password" autoComplete="new-password" className="ds-input" placeholder="Leave blank to keep" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <Button type="submit" appearance="primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Msg s={state} />
      </div>
    </form>
  );
}
