import type { ComponentProps, ReactNode } from "react";

export const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function Button({ variant = "primary", className = "", ...p }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const v = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 disabled:text-stone-400",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  }[variant];
  return <button className={`rounded-md px-3 py-2 text-sm font-medium transition ${v} ${className}`} {...p} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-stone-200 bg-white ${className}`}>{children}</section>;
}

export function Badge({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "indigo" | "green" | "amber" | "red" }) {
  const t = {
    stone: "bg-stone-100 text-stone-700",
    indigo: "bg-indigo-50 text-indigo-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
  }[tone];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
      {children}
    </label>
  );
}
