"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { FormMessage } from "@/components/form";

type State = { error?: string; ok?: string; details?: string[] };

/**
 * A form bound to a server action that keeps typed values on error (no auto-reset),
 * shows the result message, and optional per-row details.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  className = "",
  confirmText,
  footer,
  footerClass = "",
}: {
  action: (s: State, f: FormData) => Promise<State>;
  children: ReactNode;
  submitLabel: ReactNode;
  pendingLabel?: string;
  className?: string;
  confirmText?: string;
  footer?: ReactNode;
  footerClass?: string;
}) {
  const [state, run, pending] = useActionState<State, FormData>(action, {});
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmText && !confirm(confirmText)) return;
        const fd = new FormData(e.currentTarget);
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name) fd.set(submitter.name, submitter.value);
        startTransition(() => run(fd));
      }}
    >
      {children}
      <div className={`mt-4 flex flex-wrap items-center gap-3 ${footerClass}`}>
        {footer ?? <Button type="submit" appearance="primary" disabled={pending}>{pending ? pendingLabel : submitLabel}</Button>}
        <div className="min-w-0 flex-1"><FormMessage state={state} /></div>
      </div>
      {state.details && state.details.length > 0 && (
        <ul className={`mt-3 max-h-64 overflow-y-auto rounded-ds-medium border border-ds-border bg-ds-surface-sunken p-3 font-mono text-xs leading-5 ${footerClass ? "mx-4" : ""}`}>
          {state.details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
    </form>
  );
}
