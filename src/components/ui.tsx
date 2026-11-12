// UI primitives following the Intellsys design system (tokens in src/app/tokens.css).
import type { ComponentProps, ReactNode } from "react";

/** @deprecated use the .ds-input class */
export const inputCls = "ds-input";

type ButtonAppearance = "primary" | "default" | "subtle" | "selected" | "danger" | "link";

const BUTTON: Record<ButtonAppearance, string> = {
  primary:
    "bg-ds-background-brand-bold text-ds-text-inverse font-medium hover:bg-ds-background-brand-bold-hovered active:bg-ds-background-brand-bold-pressed",
  default:
    "bg-ds-background-neutral text-ds-text-subtle font-medium hover:bg-ds-background-neutral-hovered active:bg-ds-background-neutral-pressed",
  subtle: "bg-transparent text-ds-text-subtle hover:bg-ds-background-neutral-subtle-hovered active:bg-ds-background-neutral-subtle-pressed",
  selected: "bg-ds-background-selected text-ds-text-selected hover:bg-ds-background-selected-hovered",
  danger: "bg-ds-background-danger-bold text-ds-text-inverse font-medium hover:bg-ds-background-danger-bold-hovered",
  link: "bg-transparent text-ds-link hover:underline px-0",
};

export function buttonClass(appearance: ButtonAppearance = "default", extra = "") {
  return `ds-focus inline-flex h-8 items-center justify-center gap-1.5 rounded-ds-medium px-3 text-sm whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:bg-ds-background-disabled disabled:text-ds-text-disabled ${BUTTON[appearance]} ${extra}`;
}

export function Button({
  appearance = "default",
  variant,
  className = "",
  ...p
}: ComponentProps<"button"> & { appearance?: ButtonAppearance; variant?: "primary" | "secondary" | "danger" }) {
  const a: ButtonAppearance = variant === "secondary" ? "default" : variant ?? appearance;
  return <button className={buttonClass(a, className)} {...p} />;
}

/** 32×32 outlined icon button. */
export function IconButton({ className = "", ...p }: ComponentProps<"button"> & { "aria-label": string }) {
  return (
    <button
      className={`ds-focus grid h-8 w-8 place-items-center rounded-ds-small border border-ds-border bg-ds-surface text-ds-icon-subtle hover:bg-ds-surface-hovered ${className}`}
      {...p}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-ds-large border border-ds-border bg-ds-surface ${className}`}>{children}</section>;
}

export function CardHeader({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-ds-border px-4 py-3">
      <h2 className="ds-heading-small">{title}</h2>
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "information" | "success" | "warning" | "danger" | "discovery";
const LOZENGE: Record<Tone, string> = {
  neutral: "bg-ds-background-accent-gray-subtlest text-ds-text-subtle",
  information: "bg-ds-background-information text-ds-text-information",
  success: "bg-ds-background-success text-ds-text-success",
  warning: "bg-ds-background-warning text-ds-text-warning",
  danger: "bg-ds-background-danger text-ds-text-danger",
  discovery: "bg-ds-background-discovery text-ds-text-discovery",
};
const LEGACY: Record<string, Tone> = { stone: "neutral", indigo: "information", green: "success", amber: "warning", red: "danger" };

/** Status lozenge: subtle fill with its matching text token. */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone | keyof typeof LEGACY }) {
  const t = (LEGACY[tone] ?? tone) as Tone;
  return (
    <span className={`inline-flex h-5 items-center rounded-ds-small px-1.5 text-xs font-semibold whitespace-nowrap ${LOZENGE[t]}`}>
      {children}
    </span>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="ds-heading-xxsmall mb-1 block text-ds-text-subtle">
      {children}
    </label>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        <h1 className="ds-heading-large">{title}</h1>
        {description && <p className="mt-1 text-ds-text-subtle">{description}</p>}
      </div>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ds-icon-subtlest">{icon}</div>}
      <h2 className="ds-heading-medium mb-1">{title}</h2>
      {children && <div className="max-w-md text-ds-text-subtle">{children}</div>}
    </div>
  );
}

/** Muted em dash for empty values. */
export function Empty() {
  return <span className="ds-empty">—</span>;
}
