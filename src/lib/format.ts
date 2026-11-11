import { ORDER_CHANNELS, type OrderChannel } from "@/lib/orders/transform";

const dt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
const d = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });

export const fmtDateTime = (v?: string | null) => (v ? dt.format(new Date(v)) : "—");
export const fmtDate = (v?: string | null) => (v ? d.format(new Date(v)) : "—");
export const fmtMoney = (v?: number | null) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN")}`);
export const channelLabel = (c?: string | null) => ORDER_CHANNELS[(c ?? "UNMAPPED") as OrderChannel] ?? c ?? "—";
