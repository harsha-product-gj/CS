import Link from "next/link";
import { PAGE_SIZE } from "@/lib/tickets/queries";
import { buttonClass } from "@/components/ui";

export function Pager({ total, page, base }: { total: number; page: number; base: string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return <p className="mt-3 text-ds-text-subtle">{total} ticket{total === 1 ? "" : "s"}</p>;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <div className="mt-3 flex items-center gap-2 text-ds-text-subtle">
      {page > 1 && <Link className={buttonClass("subtle")} href={`${base}&page=${page - 1}`}>‹ Previous</Link>}
      <span>Page <b className="text-ds-text">{page}</b> of {pages}</span>
      {page < pages && <Link className={buttonClass("subtle")} href={`${base}&page=${page + 1}`}>Next ›</Link>}
      <span className="ml-auto">{from} – {to} of {total}</span>
    </div>
  );
}
