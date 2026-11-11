// Turns DataBank "Sale Orders" rows into orders + order_items.
// Self-contained (no imports) so both the Next.js app and Node scripts can use it.

export type OrderChannel = "AS" | "SX" | "AF" | "AR" | "FS" | "FF" | "WD" | "OT" | "NA" | "UNMAPPED";

export const ORDER_CHANNELS: Record<OrderChannel, string> = {
  AS: "Amazon Self-ship",
  SX: "Amazon Seller Flex",
  AF: "Amazon FBA",
  AR: "Amazon RetailEZ",
  FS: "Flipkart Self-ship",
  FF: "Flipkart FBF",
  WD: "Website D2C",
  OT: "Other",
  NA: "No order",
  UNMAPPED: "Unmapped",
};

export type SheetRow = Record<string, string>;

export type OrderRecord = {
  order_code: string;
  base_order_code: string | null;
  link_type: string | null;
  channel_name: string | null;
  order_channel: OrderChannel;
  order_date: string | null;
  customer_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  total_price: number | null;
  item_count: number;
  status: string | null;
};

export type ItemRecord = {
  order_code: string;
  sku: string;
  item_name: string | null;
  color: string | null;
  batch_code: string | null;
  ean: string | null;
  facility: string | null;
  package_code: string | null;
  sale_order_status: string | null;
  tracking_number: string | null;
  order_date: string | null;
  dispatch_date: string | null;
  fulfillment_tat: string | null;
  delivery_time: string | null;
  shipping_provider: string | null;
  selling_price: number | null;
  courier_status: string | null;
  tracking_status: string | null;
};

const s = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

/** Sheet timestamps are IST without a zone. */
export function istToIso(v: string | undefined): string | null {
  const t = s(v);
  if (!t || !/^\d{4}-\d{2}-\d{2}/.test(t)) return null;
  return t.replace(" ", "T") + "+05:30";
}

const num = (v: string | undefined) => {
  const t = s(v);
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Amazon masks PII as base64-like strings. */
export function looksEncrypted(v: string | null): boolean {
  if (!v) return false;
  if (v.length < 16 || /\s/.test(v) || !/^[A-Za-z0-9+/]+={0,2}$/.test(v)) return false;
  return /[+/=]/.test(v) || (/[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v));
}

export function cleanText(v: string | undefined): string | null {
  const t = s(v);
  if (!t || looksEncrypted(t)) return null;
  if (/^(xyz|na|n\/a|null|-)$/i.test(t)) return null;
  return t;
}

/** Normalises to a 10-digit Indian mobile, or null when missing/masked/encrypted. */
export function normalizePhone(v: string | undefined | null): string | null {
  const t = (v ?? "").trim();
  if (!t || looksEncrypted(t)) return null;
  let d = t.replace(/\D/g, "");
  if (d.length > 10 && (d.startsWith("91") || d.startsWith("0"))) d = d.slice(-10);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  if (/^(\d)\1{9}$/.test(d)) return null; // 9999999999 etc.
  return d;
}

export function isExcludedOrder(code: string): boolean {
  return /^(TESTORDER|SAMPLE)/i.test(code);
}

/**
 * Detects replacement / exchange / clone shipments created manually (channel CUSTOM)
 * and returns the original order code they point to.
 */
export function deriveLink(code: string): { base: string; type: string; soft: boolean } | null {
  let base = code;
  let type: string | null = null;

  const pre = base.match(/^(RPFF|RPF|RPA|RPD|C)\d*_(.+)$/);
  if (pre) {
    base = pre[2];
    type = pre[1] === "C" ? "Linked" : "Replacement";
  }
  const slash = base.match(/^([^/]+)(\/.+)$/);
  if (slash) {
    base = slash[1];
    const tail = slash[2].toLowerCase();
    type ??= tail.includes("exchange") ? "Exchange" : tail.includes("clone") ? "Clone" : "Replacement";
  }
  const rez = base.match(/^(.+)_REZ$/);
  if (rez && type) base = rez[1];
  // Soft links are only kept when the original order exists (checked in resolveLinks).
  let soft = false;
  const sf = base.match(/^(\d{3}-\d{7}-\d{7})-AMZ-SF(-\d+)?$/);
  if (sf) {
    base = sf[1];
    if (!type) {
      type = "Linked";
      soft = true;
    }
  }
  const split = base.match(/^(FS\d+)_\d+$/);
  if (split) {
    base = split[1];
    if (!type) {
      type = "Linked";
      soft = true;
    }
  }
  return type && base !== code ? { base, type, soft } : null;
}

/** Channel from the sheet's Channel Name, falling back to the order-code format. */
export function deriveChannel(channelName: string | null, code: string): OrderChannel {
  const c = (channelName ?? "").trim();
  if (/^FK/i.test(c)) return "FS";
  if (/^SF_/i.test(c)) return "SX";
  if (/^REZ_/i.test(c)) return "AR";
  if (/^amazon/i.test(c)) return "AS";
  // CUSTOM and facility-named channels (e.g. XB_MUM): infer from the order-code format.
  return channelFromCode(code);
}

export function channelFromCode(code: string): OrderChannel {
  if (/-AMZ-SF/i.test(code)) return "SX";
  if (/_REZ$/i.test(code)) return "AR";
  if (/-sho(pi|ip)fy/i.test(code)) return "WD"; // includes the "Shoipfy" typo
  const bare = code.replace(/^(RPFF|RPF|RPA|RPD|C)\d*_/, "").replace(/\/.*$/, "");
  if (/^(SH-)?FS\d/i.test(bare)) return "WD";
  if (/^OD\d/i.test(bare)) return "FS";
  if (/^\d{3}-\d{7}-\d{7}/.test(bare)) return "AS";
  return "UNMAPPED";
}

const STATUS_RANK = ["PENDING_VERIFICATION", "PROCESSING", "COMPLETE", "CANCELLED"];

/** Groups sheet rows into orders + items. Rows must belong to the same order. */
export function buildOrder(rows: SheetRow[]): { order: OrderRecord; items: ItemRecord[]; softLink: boolean } {
  const first = rows[0];
  const code = first["Display Order Code"].trim();
  const link = deriveLink(code);

  const items: ItemRecord[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const sku = s(r["Item SKU Code"]) ?? "UNKNOWN";
    if (seen.has(sku)) continue;
    seen.add(sku);
    items.push({
      order_code: code,
      sku,
      item_name: s(r["Item Type Name"]),
      color: s(r["Item Type Color"]),
      batch_code: s(r["Batch Code"]),
      ean: s(r["Item Type EAN"]),
      facility: s(r["Facility"]),
      package_code: s(r["Shipping Package Code"]),
      sale_order_status: s(r["Sale Order Status"]),
      tracking_number: s(r["Tracking Number"]),
      order_date: istToIso(r["Order Date"]),
      dispatch_date: istToIso(r["Dispatch Date"]),
      fulfillment_tat: istToIso(r["Fulfillment TAT"]),
      delivery_time: istToIso(r["Delivery Time"]),
      shipping_provider: s(r["Shipping Provider"]),
      selling_price: num(r["Selling Price"]),
      courier_status: s(r["Shipping Courier Status"]),
      tracking_status: s(r["Shipping Tracking Status"]),
    });
  }

  const withPhone = rows.find((r) => normalizePhone(r["Shipping Address Phone"])) ?? first;
  const statuses = items.map((i) => i.sale_order_status ?? "");
  const status =
    STATUS_RANK.find((st) => st !== "CANCELLED" && statuses.includes(st)) ??
    (statuses.every((st) => st === "CANCELLED") ? "CANCELLED" : statuses[0] || null);
  const total = items.reduce((a, i) => a + (i.selling_price ?? 0), 0);

  return {
    order: {
      order_code: code,
      base_order_code: link?.base ?? null,
      link_type: link?.type ?? null,
      channel_name: s(first["Channel Name"]),
      order_channel: deriveChannel(s(first["Channel Name"]), code),
      order_date: istToIso(first["Order Date"]),
      customer_name: cleanText(withPhone["Shipping Address Name"]),
      phone: normalizePhone(withPhone["Shipping Address Phone"]),
      address_line1: cleanText(withPhone["Shipping Address Line 1"]),
      address_line2: cleanText(withPhone["Shipping Address Line 2"]),
      pincode: s(withPhone["Shipping Address Pincode"]),
      city: s(withPhone["Shipping Address City"]),
      state: s(withPhone["Shipping Address State"]),
      total_price: items.length ? total : null,
      item_count: items.length,
      status,
    },
    items,
    softLink: !!link?.soft,
  };
}

/**
 * Linked shipments inherit the channel of their original order when it exists.
 * Call after all orders are built.
 */
export function resolveLinks(orders: Map<string, OrderRecord>, softLinks: Set<string>) {
  for (const o of orders.values()) {
    if (!o.base_order_code) continue;
    const base = orders.get(o.base_order_code);
    if (!base && softLinks.has(o.order_code)) {
      o.base_order_code = null;
      o.link_type = null;
      continue;
    }
    if (base) o.order_channel = base.order_channel;
    else if (o.order_channel === "UNMAPPED") o.order_channel = channelFromCode(o.base_order_code);
  }
}
