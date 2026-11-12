// Ticket option lists and rules shared by server and client (see SPEC.md §5).

export type TicketType = "enquiry" | "complaint";

export const SOURCES = ["Inbound call", "Amazon", "Flipkart", "Email", "WhatsApp", "Social media", "Other source"] as const;
export const SOCIAL_PLATFORMS = ["YouTube", "LinkedIn", "Instagram", "Facebook", "X", "Threads", "Reddit", "Other platform"] as const;

export const ENQUIRY_TYPES = ["Delivery", "Product info", "Service", "Policy", "Other"] as const;
export const COMPLAINT_TYPES = ["Order delivery", "Product damaged", "Product quality", "Wrong product", "Other"] as const;

/** Statuses an agent can pick. "Follow up for evidence" is set by the system after 24h of Awaiting evidence. */
export const STATUSES: Record<TicketType, readonly string[]> = {
  enquiry: ["Open", "In progress", "Resolved"],
  complaint: ["Open", "In progress", "Awaiting evidence", "Resolved"],
};

export const CONTACT_DIRECTIONS = ["Outbound", "Inbound"] as const;
export const CONTACT_MODES = ["Call", "WhatsApp", "Email", "Panel message"] as const;
export const CONTACT_OUTCOMES = ["Answered", "Not responded", "Not reachable"] as const;

export const FOLLOWUP_REASONS = [
  "Customer gave a time",
  "Not reachable - retry",
  "Awaiting evidence",
  "Internal follow-up",
] as const;
/** This reason pauses the resolution clock until the follow-up time (customer wait). */
export const PAUSING_REASON = "Customer gave a time";

export const RESOLUTIONS = [
  "Convinced",
  "Return & refund",
  "Replacement (same SKU)",
  "Exchange (different SKU)",
  "Partial refund",
  "Refund without return",
  "Goodwill coupon",
  "Complaint rejected",
  "Customer unresponsive",
  "Duplicate ticket",
] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

/** Resolutions that close the ticket as soon as the agent resolves it. */
export const CLOSES_ON_RESOLVE: readonly string[] = ["Convinced", "Complaint rejected", "Customer unresponsive", "Duplicate ticket"];
/** Resolutions that go to the Resolutions module and close when ops finish (refund issued / replacement delivered). */
export const NEEDS_OPS: readonly string[] = [
  "Return & refund", "Replacement (same SKU)", "Exchange (different SKU)", "Partial refund", "Refund without return",
];

/** Extra detail each resolution needs. */
export const RESOLUTION_FIELDS: Record<string, { key: string; label: string; required?: boolean; type?: "number" }[]> = {
  "Replacement (same SKU)": [{ key: "marketplace_replacement_order", label: "Marketplace replacement order ID (if the panel created one)" }],
  "Exchange (different SKU)": [
    { key: "exchange_sku", label: "SKU to send", required: true },
    { key: "price_difference", label: "Price difference (₹, + customer pays / − refund)", type: "number" },
  ],
  "Partial refund": [{ key: "refund_amount", label: "Refund amount (₹)", required: true, type: "number" }],
  "Refund without return": [{ key: "refund_amount", label: "Refund amount (₹)", required: true, type: "number" }],
  "Return & refund": [{ key: "refund_amount", label: "Refund amount (₹)", type: "number" }],
  "Goodwill coupon": [{ key: "coupon_code", label: "Coupon code (ticket closes once recorded)" }],
  "Complaint rejected": [{ key: "rejection_reason", label: "Reason for rejection", required: true }],
};

export const REVIEW_STATUSES = ["Not asked", "Agreed", "Will not review", "Review posted", "Review verified"] as const;
export const REVIEW_APPLIES: readonly string[] = ["Convinced", "Replacement (same SKU)", "Exchange (different SKU)", "Goodwill coupon"];

export const PANEL_ACTIONS = ["Accepted", "Rejected", "Not applicable"] as const;

/** Order channels a ticket can be filed against (codes from the order data). */
export const TICKET_CHANNELS = ["AS", "SX", "AF", "AR", "FS", "FF", "WD", "OT"] as const;
/** Channels we can't action on the marketplace panel: handled offline as a policy exception. */
export const POLICY_EXCEPTION_CHANNELS: readonly string[] = ["AF", "FF", "AR", "SX"];
export const MARKETPLACE_CHANNELS: readonly string[] = ["AS", "SX", "AF", "AR", "FS", "FF"];

export const SLA_FLAG_LABEL: Record<string, string> = {
  on_track: "On track",
  attention: "Needs attention",
  delayed: "Delayed",
  met: "Met SLA",
  missed: "Missed SLA",
};
export const SLA_FLAG_TONE = {
  on_track: "success",
  attention: "warning",
  delayed: "danger",
  met: "success",
  missed: "danger",
} as const;

export const STATUS_TONE: Record<string, "neutral" | "information" | "warning" | "success" | "discovery"> = {
  Open: "neutral",
  "In progress": "information",
  "Awaiting evidence": "discovery",
  "Follow up for evidence": "warning",
  Resolved: "success",
};
