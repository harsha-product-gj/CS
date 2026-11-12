"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { addNote, logContact, type ActionState } from "@/lib/tickets/actions";
import { CONTACT_DIRECTIONS, CONTACT_MODES, CONTACT_OUTCOMES } from "@/lib/tickets/constants";
import { Button } from "@/components/ui";
import { Field, FormMessage, Segmented, TextArea } from "@/components/form";
import { FollowupFields } from "@/components/tickets/fields";

/** Composer: log a call/contact (with next follow-up) or add a note. */
export function ActivityComposer({ ticketId, resolved, followAt, followReason }: { ticketId: number; resolved: boolean; followAt: string; followReason: string | null }) {
  const [tab, setTab] = useState<"contact" | "note">("contact");
  const [cState, cAction, cPending] = useActionState<ActionState, FormData>(logContact, {});
  const [nState, nAction, nPending] = useActionState<ActionState, FormData>(addNote, {});
  const noteRef = useRef<HTMLFormElement>(null);
  const contactRef = useRef<HTMLFormElement>(null);

  const submit = (fn: (fd: FormData) => void, form: HTMLFormElement) => {
    const fd = new FormData(form);
    startTransition(() => fn(fd));
  };
  // Clear the text box after a successful save.
  useEffect(() => {
    const ta = contactRef.current?.querySelector("textarea");
    if (cState.ok && ta) ta.value = "";
  }, [cState]);
  useEffect(() => {
    const ta = noteRef.current?.querySelector("textarea");
    if (nState.ok && ta) ta.value = "";
  }, [nState]);

  return (
    <div>
      <div role="tablist" className="flex gap-4 border-b border-ds-border px-4">
        {[
          { id: "contact", label: "Log call / contact" },
          { id: "note", label: "Add note" },
        ].map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id as "contact" | "note")}
            className={`-mb-px border-b-2 py-2 ${tab === x.id ? "border-ds-border-selected font-medium text-ds-text-selected" : "border-transparent text-ds-text"}`}>
            {x.label}
          </button>
        ))}
      </div>

      {tab === "contact" ? (
        <form ref={contactRef} className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); submit(cAction, e.currentTarget); }}>
          <input type="hidden" name="id" value={ticketId} />
          <div className="grid gap-3 lg:grid-cols-3">
            <Field label="Direction"><Segmented name="direction" defaultValue="Outbound" options={CONTACT_DIRECTIONS} /></Field>
            <Field label="Mode"><Segmented name="mode" defaultValue="Call" options={CONTACT_MODES} /></Field>
            <Field label="Outcome"><Segmented name="outcome" defaultValue="Answered" options={CONTACT_OUTCOMES} /></Field>
          </div>
          <Field label="What was discussed" htmlFor="contact_note">
            <TextArea id="contact_note" name="note" rows={2} placeholder="So the next caller knows where things stand" />
          </Field>
          {!resolved && <FollowupFields idPrefix="c_" defaultAt={followAt} defaultReason={followReason} />}
          <div className="flex items-center gap-3">
            <Button type="submit" appearance="primary" disabled={cPending}>{cPending ? "Saving…" : "Log contact"}</Button>
            <div className="min-w-0 flex-1"><FormMessage state={cState} /></div>
          </div>
        </form>
      ) : (
        <form ref={noteRef} className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); submit(nAction, e.currentTarget); }}>
          <input type="hidden" name="id" value={ticketId} />
          <TextArea name="body" rows={3} required placeholder="Add a note. It’s saved with your name and the time." />
          <div className="flex items-center gap-3">
            <Button type="submit" appearance="primary" disabled={nPending}>{nPending ? "Saving…" : "Add note"}</Button>
            <div className="min-w-0 flex-1"><FormMessage state={nState} /></div>
          </div>
        </form>
      )}
    </div>
  );
}
