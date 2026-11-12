import { ChevronDown } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { CreateUserForm, DeleteUserButton, EditUserForm } from "./user-forms";

const ROLE_TONE = { admin: "discovery", ops: "warning", agent: "information" } as const;

export default async function UsersPage() {
  const me = await requireUser("admin");
  const { data: users, error } = await db()
    .from("profiles")
    .select("id, username, full_name, roles, active, created_at")
    .order("active", { ascending: false })
    .order("username");
  if (error) throw error;

  return (
    <>
      <PageHeader title="Users" description="People who can sign in, and what they can do." />

      <Card className="mb-6">
        <CardHeader title="Add user" />
        <div className="p-4">
          <CreateUserForm />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={`Team (${users?.length ?? 0})`} />
        <ul className="divide-y divide-ds-border">
          {users?.map((u) => (
            <li key={u.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-ds-surface-hovered [&::-webkit-details-marker]:hidden">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-ds-background-accent-gray-subtlest text-xs font-semibold text-ds-text-subtle">
                    {u.full_name.split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join("")}
                  </span>
                  <span className="min-w-40">
                    <span className="block font-medium">{u.full_name}</span>
                    <span className="block text-xs text-ds-text-subtlest">@{u.username}</span>
                  </span>
                  <span className="flex gap-1">
                    {u.roles.map((r: keyof typeof ROLE_TONE) => (
                      <Badge key={r} tone={ROLE_TONE[r] ?? "neutral"}>{r}</Badge>
                    ))}
                  </span>
                  {!u.active && <Badge tone="danger">Inactive</Badge>}
                  {u.id === me.id && <Badge>You</Badge>}
                  <span className="ml-auto text-xs text-ds-text-subtlest">Added {fmtDate(u.created_at)}</span>
                  <ChevronDown size={16} className="text-ds-icon-subtle transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-ds-border bg-ds-surface-sunken px-4 py-4">
                  <EditUserForm user={u} />
                  {u.id !== me.id && (
                    <div className="mt-4 flex justify-end border-t border-ds-border pt-3">
                      <DeleteUserButton id={u.id} username={u.username} />
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
