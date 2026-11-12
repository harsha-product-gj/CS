import Link from "next/link";
import { ChevronDown, LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { SearchBar } from "@/components/search-bar";
import type { CurrentUser } from "@/lib/auth";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function Brand() {
  return (
    <Link href="/search" className="ds-focus flex items-center gap-2 rounded-ds-small">
      <span className="grid h-7 w-7 place-items-center rounded-ds-medium bg-ds-background-brand-bold text-[13px] font-bold text-ds-text-inverse">
        SH
      </span>
      <span className="hidden font-semibold text-ds-text sm:inline">SleepyHug</span>
      <span className="hidden rounded-ds-small bg-ds-background-selected px-1.5 text-xs font-semibold text-ds-text-selected sm:inline">
        CS
      </span>
    </Link>
  );
}

export function TopBar({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-ds-border bg-ds-surface px-3 md:gap-4">
      {/* Same width as rail + module sidebar, so the search lines up with the page */}
      <div className="shrink-0 lg:w-[268px]">
        <Brand />
      </div>
      <div className="min-w-0 flex-1 md:max-w-xl">
        <SearchBar />
      </div>
      <details className="relative ml-auto">
        <summary className="ds-focus flex cursor-pointer list-none items-center gap-2 rounded-ds-medium px-1.5 py-1 hover:bg-ds-background-neutral-subtle-hovered [&::-webkit-details-marker]:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ds-background-accent-blue-subtler text-xs font-semibold text-ds-text-accent-blue">
            {initials(user.fullName)}
          </span>
          <span className="hidden text-left leading-tight lg:block">
            <span className="block text-sm text-ds-text">{user.fullName}</span>
            <span className="block text-xs capitalize text-ds-text-subtlest">{user.roles.join(", ")}</span>
          </span>
          <ChevronDown size={16} className="hidden text-ds-icon-subtle lg:block" aria-hidden />
        </summary>
        <div className="absolute right-0 mt-1 w-56 rounded-ds-medium border border-ds-border bg-ds-surface-overlay p-1 shadow-ds-overlay">
          <div className="border-b border-ds-border px-3 py-2">
            <p className="font-medium">{user.fullName}</p>
            <p className="text-xs text-ds-text-subtlest">@{user.username}</p>
          </div>
          <form action={logout}>
            <button className="mt-1 flex w-full items-center gap-2 rounded-ds-small px-3 py-2 text-left text-ds-text-subtle hover:bg-ds-background-neutral-subtle-hovered">
              <LogOut size={16} aria-hidden /> Sign out
            </button>
          </form>
        </div>
      </details>
    </header>
  );
}
