// Navigation model: apps in the left rail, each with its own module list.
import type { Role } from "@/lib/auth";

export type IconName =
  | "support" | "operations" | "insights" | "admin"
  | "search" | "tickets" | "followups" | "missed" | "resolutions" | "pickups" | "dispatches"
  | "dashboard" | "users" | "data" | "alltickets" | "sla";

export type NavItem = { label: string; href: string; icon: IconName; soon?: boolean };
export type NavApp = {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  /** Path prefixes that belong to this app. */
  match: string[];
  roles?: Role[];
  soon?: boolean;
  items: NavItem[];
};

export const APPS: NavApp[] = [
  {
    id: "support",
    label: "Support",
    icon: "support",
    href: "/search",
    match: ["/search", "/customers", "/tickets"],
    items: [
      { label: "Customer search", href: "/search", icon: "search" },
      { label: "My tickets", href: "/tickets", icon: "tickets" },
      { label: "All tickets", href: "/tickets/all", icon: "alltickets" },
      { label: "Missed calls", href: "/missed-calls", icon: "missed", soon: true },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: "operations",
    href: "/resolutions",
    match: ["/resolutions", "/pickups", "/dispatches"],
    soon: true,
    items: [
      { label: "Resolutions", href: "/resolutions", icon: "resolutions", soon: true },
      { label: "Pickups", href: "/pickups", icon: "pickups", soon: true },
      { label: "Dispatches", href: "/dispatches", icon: "dispatches", soon: true },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: "insights",
    href: "/dashboard",
    match: ["/dashboard"],
    soon: true,
    items: [{ label: "Dashboard", href: "/dashboard", icon: "dashboard", soon: true }],
  },
  {
    id: "admin",
    label: "Admin",
    icon: "admin",
    href: "/admin/users",
    match: ["/admin"],
    roles: ["admin"],
    items: [
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "SLA settings", href: "/admin/sla", icon: "sla" },
      { label: "Order data", href: "/admin/data", icon: "data" },
    ],
  },
];

export function appsFor(roles: Role[]) {
  return APPS.filter((a) => !a.roles || a.roles.some((r) => roles.includes(r)));
}

export function activeApp(pathname: string, apps: NavApp[]) {
  return apps.find((a) => a.match.some((m) => pathname === m || pathname.startsWith(m + "/"))) ?? apps[0];
}
