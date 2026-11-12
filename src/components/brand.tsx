// SleepyHug brand marks, from the SleepyHug brand guideline:
// green #3A6549, orange #FE8100, cream #FAEED6, off-white #FFFDFA; typeface Poetsen One.

/** The bed glyph that stands in for the "h" in the wordmark. */
export function BedGlyph({ className = "", frame = "#FE8100", mattress = "#3A6549" }: { className?: string; frame?: string; mattress?: string }) {
  return (
    <svg viewBox="0 0 120 70" className={className} aria-hidden>
      <rect x="0" y="0" width="13" height="70" rx="3" fill={frame} />
      <rect x="107" y="0" width="13" height="70" rx="3" fill={frame} />
      <rect x="11" y="44" width="98" height="13" fill={frame} />
      <path d="M15 22h80a8 8 0 0 1 8 8v12H15z" fill={mattress} />
    </svg>
  );
}

/** Full wordmark: "sleepy" + bed + "ug". `size` is the cap height in px. */
export function Wordmark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`sh-wordmark inline-flex items-end leading-none select-none ${className}`}
      style={{ fontSize: size, fontFamily: "var(--font-poetsen), var(--font-sans)" }}
      aria-label="SleepyHug"
      role="img"
    >
      <span className="sh-wordmark-sleepy" aria-hidden>sleepy</span>
      <BedGlyph className="mx-[0.04em] mb-[0.08em] h-[1.02em] w-auto" />
      <span className="text-[#FE8100]" aria-hidden>ug</span>
    </span>
  );
}

/** Square app mark: orange bed on green, as in the brand guideline. */
export function BrandMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-ds-medium bg-[#3A6549] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <BedGlyph className="w-[70%]" mattress="#FAEED6" />
    </span>
  );
}
