import Link from "next/link";
import type { TicketListRow } from "@/lib/tickets/queries";
import { SLA_FLAG_LABEL, SLA_FLAG_TONE, STATUS_TONE } from "@/lib/tickets/constants";
import { fmtDateTime, fmtRelative, requestTime } from "@/lib/format";
import { Badge, Empty } from "@/components/ui";

export function TicketTable({ rows, showOwner = true, now }: { rows: TicketListRow[]; showOwner?: boolean; now?: number }) {
  now ??= requestTime();
  return (
    <div className="overflow-x-auto">
      <table className="ds-table min-w-[900px]">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Customer</th>
            <th>Type</th>
            <th>Status</th>
            <th>SLA</th>
            <th>Next Follow-up</th>
            <th className="ds-num">Calls</th>
            {showOwner && <th>Owner</th>}
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const overdue = !t.is_closed && t.next_followup_at && new Date(t.next_followup_at).getTime() < now;
            return (
              <tr key={t.id}>
                <td>
                  <Link href={`/tickets/${encodeURIComponent(t.code)}`} className="font-mono text-[13px] font-medium text-ds-link hover:underline">{t.code}</Link>
                  {t.parent_ticket_id && <div className="text-xs text-ds-text-subtlest">Duplicate</div>}
                </td>
                <td>
                  <div>{t.customer_name ?? <Empty />}</div>
                  <div className="font-mono text-xs text-ds-text-subtlest">{t.phone ?? t.order_code ?? ""}</div>
                </td>
                <td>
                  <div>{t.type === "complaint" ? "Complaint" : "Enquiry"}</div>
                  <div className="text-xs text-ds-text-subtlest">{t.category}</div>
                </td>
                <td>
                  <Badge tone={STATUS_TONE[t.display_status] ?? "neutral"}>{t.display_status}</Badge>
                  {t.is_closed && <div className="mt-1"><Badge>Closed</Badge></div>}
                </td>
                <td><Badge tone={SLA_FLAG_TONE[t.sla_flag]}>{SLA_FLAG_LABEL[t.sla_flag]}</Badge></td>
                <td className="whitespace-nowrap">
                  {t.next_followup_at ? (
                    <>
                      <div className={overdue ? "font-semibold text-ds-text-danger" : ""}>{fmtRelative(t.next_followup_at, now)}</div>
                      <div className="text-xs text-ds-text-subtlest">{fmtDateTime(t.next_followup_at)}</div>
                    </>
                  ) : t.is_closed ? <Empty /> : <span className="text-ds-text-warning">Not set</span>}
                </td>
                <td className="ds-num whitespace-nowrap">{t.contacts_answered}/{t.contacts_total}</td>
                {showOwner && (
                  <td>
                    <div>{t.owner_name ?? <Empty />}</div>
                    {t.temp_owner_name && <div className="text-xs text-ds-text-subtlest">Covering: {t.temp_owner_name}</div>}
                  </td>
                )}
                <td className="text-ds-text-subtle">{t.source}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
