// Form controls in the Intellsys style.
import type { ComponentProps, ReactNode } from "react";
import { Label } from "@/components/ui";

export function Field({ label, htmlFor, hint, children, className = "" }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-ds-text-subtlest">{hint}</p>}
    </div>
  );
}

export function Select({ options, placeholder, className = "", ...p }: ComponentProps<"select"> & { options: readonly (string | { value: string; label: string })[]; placeholder?: string }) {
  return (
    <select className={`ds-input pr-8 ${className}`} {...p}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function TextArea({ className = "", ...p }: ComponentProps<"textarea">) {
  return <textarea className={`ds-input h-auto min-h-20 py-2 ${className}`} {...p} />;
}

/** Segmented single-choice control (radio buttons styled as Intellsys selected chips). */
export function Segmented({ name, options, value, defaultValue, onChange }: { name: string; options: readonly (string | { value: string; label: string })[]; value?: string; defaultValue?: string; onChange?: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <label key={v} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={v}
              className="peer sr-only"
              {...(value !== undefined ? { checked: value === v, onChange: () => onChange?.(v) } : { defaultChecked: defaultValue === v, onChange: () => onChange?.(v) })}
            />
            <span className="inline-flex h-8 items-center rounded-ds-medium border border-ds-border bg-ds-surface px-3 text-ds-text-subtle peer-checked:border-transparent peer-checked:bg-ds-background-selected peer-checked:text-ds-text-selected peer-focus-visible:outline-2 peer-focus-visible:outline-ds-border-focused">
              {l}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function FormMessage({ state }: { state: { error?: string; ok?: string } }) {
  if (state.error) return <p role="alert" className="rounded-ds-medium bg-ds-background-danger px-3 py-2 text-ds-text-danger">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-ds-medium bg-ds-background-success px-3 py-2 text-ds-text-success">{state.ok}</p>;
  return null;
}
