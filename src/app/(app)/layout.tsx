import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { SearchBar } from "@/components/search-bar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const isAdmin = user.roles.includes("admin");
  const nav = [
    { href: "/search", label: "Search" },
    ...(isAdmin ? [{ href: "/admin/users", label: "Users" }, { href: "/admin/data", label: "Order data" }] : []),
  ];
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Link href="/search" className="font-semibold text-indigo-700">SleepyHug CS</Link>
          <nav className="flex gap-4 text-sm text-stone-600">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-stone-900">{n.label}</Link>
            ))}
          </nav>
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1"><SearchBar /></div>
          <div className="ml-auto flex items-center gap-3 text-sm sm:ml-0">
            <span className="text-stone-600">{user.fullName}</span>
            <form action={logout}>
              <button className="text-stone-500 hover:text-stone-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
