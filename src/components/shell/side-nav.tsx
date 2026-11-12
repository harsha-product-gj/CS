"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeApp, type NavApp } from "@/lib/nav";
import { NavIcon } from "./icons";

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** 48px app rail (desktop). */
export function AppRail({ apps }: { apps: NavApp[] }) {
  const current = activeApp(usePathname(), apps);
  return (
    <nav aria-label="Apps" className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-ds-border bg-ds-surface pt-2 md:flex">
      {apps.map((a) => {
        const on = a.id === current.id;
        const cls = `grid h-10 w-10 place-items-center rounded-[3px] ${
          on ? "bg-ds-background-selected text-ds-icon-brand" : "text-ds-icon-subtle"
        }`;
        return a.soon ? (
          <span key={a.id} title={`${a.label} (coming soon)`} className={`${cls} cursor-not-allowed opacity-40`}>
            <NavIcon name={a.icon} size={20} />
          </span>
        ) : (
          <Link key={a.id} href={a.href} title={a.label} aria-current={on ? "page" : undefined}
            className={`${cls} ds-focus hover:bg-ds-background-neutral-subtle-hovered`}>
            <NavIcon name={a.icon} size={20} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Module list for the active app (desktop sidebar, mobile tab row). */
export function ModuleNav({ apps, variant }: { apps: NavApp[]; variant: "sidebar" | "tabs" }) {
  const pathname = usePathname();
  const app = activeApp(pathname, apps);

  if (variant === "tabs") {
    return (
      <nav aria-label={app.label} className="-mx-4 mb-4 flex gap-4 overflow-x-auto border-b border-ds-border px-4 md:-mx-6 md:px-6 lg:hidden">
        {app.items.filter((i) => !i.soon).map((i) => {
          const on = isActive(pathname, i.href);
          return (
            <Link key={i.href} href={i.href}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-2 ${
                on ? "border-ds-border-selected font-medium text-ds-text-selected" : "border-transparent text-ds-text"
              }`}>
              <NavIcon name={i.icon} /> {i.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={app.label} className="hidden w-56 shrink-0 border-r border-ds-border bg-ds-surface p-2 lg:block">
      <p className="ds-heading-xxsmall px-2 pt-2 pb-2 text-ds-text-subtlest uppercase">{app.label}</p>
      <ul className="space-y-0.5">
        {app.items.map((i) => {
          const on = isActive(pathname, i.href);
          const base = "relative flex h-8 items-center gap-2 rounded-ds-small px-2";
          return (
            <li key={i.href}>
              {i.soon ? (
                <span className={`${base} cursor-not-allowed text-ds-text-disabled`} title="Coming soon">
                  <NavIcon name={i.icon} /> {i.label}
                  <span className="ml-auto text-[11px] font-semibold text-ds-text-subtlest">Soon</span>
                </span>
              ) : (
                <Link href={i.href} aria-current={on ? "page" : undefined}
                  className={`${base} ds-focus ${
                    on
                      ? "bg-ds-background-selected text-ds-text-selected before:absolute before:top-1.5 before:bottom-1.5 before:-left-2 before:w-0.5 before:rounded before:bg-ds-border-selected"
                      : "text-ds-text-subtle hover:bg-ds-background-neutral-subtle-hovered"
                  }`}>
                  <NavIcon name={i.icon} /> {i.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile: the rail becomes a bottom tab bar. */
export function BottomTabs({ apps }: { apps: NavApp[] }) {
  const current = activeApp(usePathname(), apps);
  return (
    <nav aria-label="Apps" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-ds-border bg-ds-surface md:hidden">
      {apps.filter((a) => !a.soon).map((a) => {
        const on = a.id === current.id;
        return (
          <Link key={a.id} href={a.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${on ? "text-ds-text-selected" : "text-ds-text-subtle"}`}>
            <NavIcon name={a.icon} size={20} />
            {a.label}
          </Link>
        );
      })}
    </nav>
  );
}
