import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/orders/transform";
import { ticketsForCustomer } from "@/lib/tickets/queries";
import { PageHeader } from "@/components/ui";
import { NewTicketForm, type NewTicketPrefill } from "./new-ticket-form";

export default async function NewTicketPage({ searchParams }: PageProps<"/tickets/new">) {
  await requireUser();
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const client = db();

  let prefill: NewTicketPrefill = { items: [] };
  const orderCode = get("order");
  const q = get("q");
  const phoneParam = normalizePhone(get("phone") || q);

  if (orderCode) {
    const [{ data: o }, { data: items }] = await Promise.all([
      client.from("orders").select("*").eq("order_code", orderCode).maybeSingle(),
      client.from("order_items").select("sku, item_name, color, sale_order_status").eq("order_code", orderCode),
    ]);
    if (o) {
      prefill = {
        orderCode: o.order_code,
        orderChannel: o.order_channel === "UNMAPPED" ? "" : o.order_channel,
        orderInData: true,
        customerName: o.customer_name ?? "",
        phone: o.phone ?? "",
        address: [o.address_line1, o.address_line2, o.city, o.state].filter(Boolean).join(", "),
        pincode: o.pincode ?? "",
        orderDate: o.order_date,
        items: (items ?? []).map((i) => ({ sku: i.sku, name: i.item_name ?? i.sku })),
      };
    } else {
      prefill.orderCode = orderCode;
    }
  } else if (phoneParam) {
    const { data: o } = await client.from("orders").select("customer_name, address_line1, address_line2, city, state, pincode").eq("phone", phoneParam).order("order_date", { ascending: false }).limit(1).maybeSingle();
    prefill = {
      items: [],
      phone: phoneParam,
      customerName: o?.customer_name ?? "",
      address: o ? [o.address_line1, o.address_line2, o.city, o.state].filter(Boolean).join(", ") : "",
      pincode: o?.pincode ?? "",
    };
  } else if (q) {
    // Unknown search text: treat as an order ID typed by the agent
    prefill.orderCode = q;
  }

  const existing = await ticketsForCustomer({
    phones: prefill.phone ? [prefill.phone] : [],
    orderCodes: prefill.orderCode ? [prefill.orderCode] : [],
  });

  return (
    <>
      <PageHeader title="New ticket" description="Log an enquiry or complaint. You’ll be the owner." />
      <NewTicketForm
        prefill={prefill}
        openTickets={existing.filter((t) => !t.is_closed && !t.parent_ticket_id).map((t) => ({ code: t.code, status: t.display_status, owner: t.owner_name, source: t.source, category: t.category }))}
        closedTickets={existing.filter((t) => t.is_closed).map((t) => ({ code: t.code, category: t.category, resolution: t.resolution }))}
      />
    </>
  );
}
