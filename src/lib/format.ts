import { ORDER_CHANNELS, type OrderChannel } from "@/lib/orders/transform";

const dt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
const d = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });

export const fmtDateTime = (v?: string | null) => (v ? dt.format(new Date(v)) : "—");
export const fmtDate = (v?: string | null) => (v ? d.format(new Date(v)) : "—");
export const fmtMoney = (v?: number | null) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN")}`);
export const channelLabel = (c?: string | null) => ORDER_CHANNELS[(c ?? "UNMAPPED") as OrderChannel] ?? c ?? "—";

/** ISO → value for <input type="datetime-local"> in IST. */
export function toISTInput(v?: string | Date | null) {
  if (!v) return "";
  const d = new Date(new Date(v).getTime() + 5.5 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value (IST) → ISO, or null. */
export function fromISTInput(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return null;
  const d = new Date(`${s.slice(0, 16)}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** 93784 → "1d 2h", 4500 → "1h 15m", 300 → "5m". Negative values get a minus sign. */
export function fmtDuration(seconds?: number | null) {
  if (seconds == null) return "—";
  const neg = seconds < 0;
  let s = Math.abs(Math.round(seconds));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60);
  const out = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  return neg ? `-${out}` : out;
}

/** Relative time like "in 3h 10m" / "2h 5m ago". */
export function fmtRelative(v?: string | null, now = Date.now()) {
  if (!v) return "—";
  const diff = (new Date(v).getTime() - now) / 1000;
  return diff >= 0 ? `in ${fmtDuration(diff)}` : `${fmtDuration(-diff)} ago`;
}

/** Request-time clock for server components (keeps render functions free of direct Date.now calls). */
export function requestTime() {
  return Date.now();
}
