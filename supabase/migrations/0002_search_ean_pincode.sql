-- Search by EAN (Amazon ASIN / Flipkart FSN) and by delivery pincode.

create index if not exists order_items_ean_upper_idx on public.order_items (upper(ean)) where ean is not null;
create index if not exists order_items_order_date_idx on public.order_items (order_date desc);
create index if not exists orders_pincode_idx on public.orders (pincode, order_date desc) where pincode is not null;

create or replace function public.search_orders(q text, max_rows int default 100)
returns table (order_code text, matched_on text)
language plpgsql stable
set search_path = public
as $$
declare
  raw    text := btrim(q);
  digits text := regexp_replace(raw, '\D', '', 'g');
begin
  if raw is null or length(raw) < 3 then
    return;
  end if;

  -- pincode: exactly 6 digits, newest orders first
  if raw ~ '^\d{6}$' then
    return query
      select o.order_code, 'pincode'::text from orders o
      where o.pincode = raw
      order by o.order_date desc nulls last
      limit max_rows;
    return;
  end if;

  -- phone (accepts +91 / 0 prefixes, spaces, dashes)
  if raw ~ '^[+\d\s()-]+$' and length(digits) between 10 and 13 then
    return query
      select o.order_code, 'phone'::text from orders o
      where o.phone = right(digits, 10)
      limit max_rows;
  end if;

  -- exact order ID (or the original of a linked shipment)
  return query
    select o.order_code, 'order'::text from orders o
    where lower(o.order_code) = lower(raw)
       or lower(o.base_order_code) = lower(raw)
    limit max_rows;

  -- AWB / tracking number
  return query
    select distinct i.order_code, 'awb'::text from order_items i
    where i.tracking_number = raw
    limit max_rows;

  -- EAN: Amazon ASIN (B0…) or Flipkart FSN, newest orders first
  if raw ~ '^[A-Za-z0-9]{10,16}$' and raw ~ '[A-Za-z]' then
    return query
      select i.order_code, 'ean'::text from order_items i
      where upper(i.ean) = upper(raw)
      order by i.order_date desc nulls last
      limit max_rows;
  end if;

  -- customer name (needs letters)
  if raw ~ '[A-Za-z]' then
    return query
      select o.order_code, 'name'::text from orders o
      where o.customer_name ilike '%' || raw || '%'
      order by o.order_date desc nulls last
      limit max_rows;
  end if;
end;
$$;

revoke all on function public.search_orders(text, int) from public, anon, authenticated;
grant execute on function public.search_orders(text, int) to service_role;
