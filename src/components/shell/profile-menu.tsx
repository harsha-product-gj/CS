"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { logout } from "@/app/login/actions";

type ThemePref = "light" | "dark" | "system";

const THEMES: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Match system", icon: Monitor },
];

function resolve(pref: ThemePref) {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(pref: ThemePref) {
  const d = document.documentElement;
  d.setAttribute("data-color-mode", resolve(pref));
  d.setAttribute("data-theme-pref", pref);
  try {
    localStorage.setItem("sh-theme", pref);
  } catch {}
}

function readPref(): ThemePref {
  if (typeof document === "undefined") return "light";
  return (document.documentElement.getAttribute("data-theme-pref") as ThemePref) || "light";
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-ds-background-accent-blue-subtler font-semibold text-ds-text-accent-blue"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function ProfileMenu({ user }: { user: { fullName: string; username: string; roles: string[] } }) {
  const [open, setOpen] = useState(false);
  const [pref, setPref] = useState<ThemePref>(readPref);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Follow the OS while "Match system" is chosen.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pref]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Your profile and settings (${user.fullName})`}
        className="ds-focus grid place-items-center rounded-full p-0.5 hover:bg-ds-background-neutral-subtle-hovered"
      >
        <Avatar name={user.fullName} size={30} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-72 rounded-ds-medium border border-ds-border bg-ds-surface-overlay py-2 shadow-ds-overlay">
          <div className="flex items-center gap-3 px-4 pt-1 pb-3">
            <Avatar name={user.fullName} size={40} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.fullName}</p>
              <p className="truncate text-xs text-ds-text-subtlest">
                @{user.username} · <span className="capitalize">{user.roles.join(", ")}</span>
              </p>
            </div>
          </div>

          <div className="border-t border-ds-border pt-2">
            <p className="ds-heading-xxsmall px-4 pb-1 text-ds-text-subtlest">Theme</p>
            {THEMES.map((t) => {
              const Icon = t.icon;
              const on = pref === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => {
                    applyTheme(t.id);
                    setPref(t.id);
                  }}
                  className={`flex h-9 w-full items-center gap-3 px-4 text-left hover:bg-ds-background-neutral-subtle-hovered ${
                    on ? "text-ds-text-selected" : "text-ds-text"
                  }`}
                >
                  <Icon size={16} aria-hidden className={on ? "text-ds-icon-brand" : "text-ds-icon-subtle"} />
                  {t.label}
                  {on && <Check size={16} className="ml-auto text-ds-icon-brand" aria-hidden />}
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-ds-border pt-2">
            <form action={logout}>
              <button role="menuitem" className="flex h-9 w-full items-center gap-3 px-4 text-left text-ds-text hover:bg-ds-background-neutral-subtle-hovered">
                <LogOut size={16} className="text-ds-icon-subtle" aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
