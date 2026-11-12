import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { BrandMark, Wordmark } from "@/components/brand";
import type { CurrentUser } from "@/lib/auth";
import { ProfileMenu } from "./profile-menu";
import { SidebarToggle } from "./sidebar-toggle";

export function Brand({ size = 20 }: { size?: number }) {
  return (
    <Link href="/search" className="ds-focus flex items-center gap-2 rounded-ds-small" aria-label="SleepyHug CS home">
      <BrandMark size={28} className="sm:hidden" />
      <Wordmark size={size} className="hidden sm:inline-flex" />
      <span className="hidden rounded-ds-small bg-ds-background-neutral px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-ds-text-subtle sm:inline">
        CS
      </span>
    </Link>
  );
}

export function TopBar({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-ds-border bg-ds-surface px-3 md:gap-3">
      <SidebarToggle />
      <div className="shrink-0 lg:w-[226px]">
        <Brand />
      </div>
      <div className="min-w-0 flex-1 md:max-w-xl">
        <SearchBar />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ProfileMenu user={{ fullName: user.fullName, username: user.username, roles: user.roles }} />
      </div>
    </header>
  );
}
