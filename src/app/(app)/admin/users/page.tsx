import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { CreateUserForm, DeleteUserButton, EditUserForm } from "./user-forms";

export default async function UsersPage() {
  const me = await requireUser("admin");
  const { data: users, error } = await db()
    .from("profiles")
    .select("id, username, full_name, roles, active, created_at")
    .order("active", { ascending: false })
    .order("username");
  if (error) throw error;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Users</h1>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">Add user</h2>
        <CreateUserForm />
      </Card>

      <div className="space-y-3">
        {users?.map((u) => (
          <Card key={u.id} className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{u.username}</span>
              {u.roles.map((r: string) => (
                <Badge key={r} tone={r === "admin" ? "indigo" : "stone"}>{r}</Badge>
              ))}
              {!u.active && <Badge tone="red">inactive</Badge>}
              <span className="ml-auto text-xs text-stone-400">added {fmtDate(u.created_at)}</span>
              {u.id !== me.id && <DeleteUserButton id={u.id} username={u.username} />}
            </div>
            <EditUserForm user={u} />
          </Card>
        ))}
      </div>
    </div>
  );
}
