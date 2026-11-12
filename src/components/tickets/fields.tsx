"use client";

import { useState } from "react";
import { Field, Select } from "@/components/form";
import { FOLLOWUP_REASONS, PAUSING_REASON, SOCIAL_PLATFORMS, SOURCES } from "@/lib/tickets/constants";

function istInput(d: Date) {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 16);
}
function presets() {
  const now = Date.now();
  const tomorrow11 = new Date(now + 5.5 * 3600_000);
  tomorrow11.setUTCDate(tomorrow11.getUTCDate() + 1);
  tomorrow11.setUTCHours(11, 0, 0, 0);
  return [
    { label: "+1h", at: new Date(now + 3600_000) },
    { label: "+3h", at: new Date(now + 3 * 3600_000) },
    { label: "Tomorrow 11 AM", at: new Date(tomorrow11.getTime() - 5.5 * 3600_000) },
    { label: "+24h", at: new Date(now + 24 * 3600_000) },
  ];
}

/** Next follow-up date/time (IST) + reason, with quick presets. */
export function FollowupFields({ defaultAt, defaultReason, required = true, idPrefix = "" }: { defaultAt?: string; defaultReason?: string | null; required?: boolean; idPrefix?: string }) {
  const [at, setAt] = useState(defaultAt ?? "");
  const [reason, setReason] = useState(defaultReason ?? "");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Next follow-up (IST)" htmlFor={`${idPrefix}next_followup_at`}>
        <input id={`${idPrefix}next_followup_at`} name="next_followup_at" type="datetime-local" required={required} value={at} onChange={(e) => setAt(e.target.value)} className="ds-input" />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {presets().map((p) => (
            <button key={p.label} type="button" onClick={() => setAt(istInput(p.at))}
              className="h-6 rounded-ds-small bg-ds-background-neutral px-2 text-xs text-ds-text-subtle hover:bg-ds-background-neutral-hovered">
              {p.label}
            </button>
          ))}
        </div>
      </Field>
      <Field
        label="Reason"
        htmlFor={`${idPrefix}next_followup_reason`}
        hint={reason === PAUSING_REASON ? "The resolution clock pauses until this time (counted as customer wait)." : undefined}
      >
        <Select
          id={`${idPrefix}next_followup_reason`}
          name="next_followup_reason"
          required={required}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (e.target.value === "Awaiting evidence" && !at) setAt(istInput(new Date(Date.now() + 24 * 3600_000)));
          }}
          options={FOLLOWUP_REASONS}
          placeholder="Choose…"
        />
      </Field>
    </div>
  );
}

/** Source + social platform / other text. */
export function SourceFields({ defaultSource, defaultDetail }: { defaultSource?: string; defaultDetail?: string | null }) {
  const [source, setSource] = useState(defaultSource ?? "");
  const detail = defaultDetail ?? "";
  const isOtherPlatform = detail.startsWith("Other: ");
  const [platform, setPlatform] = useState(
    source === "Social media" ? (isOtherPlatform ? "Other platform" : detail) : "",
  );
  const otherDefault = source === "Other source" ? detail : isOtherPlatform ? detail.slice(7) : "";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Source" htmlFor="source">
        <Select id="source" name="source" required value={source} onChange={(e) => setSource(e.target.value)} options={SOURCES} placeholder="Where did they reach us?" />
      </Field>
      {source === "Social media" && (
        <Field label="Platform" htmlFor="social_platform">
          <Select id="social_platform" name="social_platform" required value={platform} onChange={(e) => setPlatform(e.target.value)} options={SOCIAL_PLATFORMS} placeholder="Choose…" />
        </Field>
      )}
      {(source === "Other source" || (source === "Social media" && platform === "Other platform")) && (
        <Field label={source === "Other source" ? "Specify source" : "Specify platform"} htmlFor="source_other">
          <input id="source_other" name="source_other" required defaultValue={otherDefault} className="ds-input" />
        </Field>
      )}
    </div>
  );
}
