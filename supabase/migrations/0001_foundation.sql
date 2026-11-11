-- Foundation: users/roles, orders base, sync runs, audit log, search

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- users
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  full_name   text not null,
  roles       text[] not null default '{agent}'
              check (roles <@ array['agent','ops','admin']::text[] and cardinality(roles) > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- orders
-- order_channel codes: AS Amazon Self-ship, SX Amazon Seller Flex, AF Amazon FBA,
-- AR Amazon RetailEZ, FS Flipkart Self-ship, FF Flipkart FBF, WD Website D2C,
-- OT Other, UNMAPPED = channel name not recognised yet
create table if not exists public.orders (
  order_code        text primary key,
  base_order_code   text,              -- set when this is a replacement/exchange/clone shipment
  link_type         text,              -- Replacement | Exchange | Clone | Linked
  channel_name      text,
  order_channel     text not null,
  order_date        timestamptz,
  customer_name     text,
  phone             text,              -- normalised 10-digit, null if masked/encrypted
  address_line1     text,
  address_line2     text,
  pincode           text,
  city              text,
  state             text,
  total_price       numeric(12,2),
  item_count        int not null default 0,
  status            text,
  synced_at         timestamptz not null default now()
);
create index if not exists orders_phone_idx     on public.orders (phone) where phone is not null;
create index if not exists orders_base_idx      on public.orders (base_order_code) where base_order_code is not null;
create index if not exists orders_code_lower_idx on public.orders (lower(order_code));
create index if not exists orders_name_trgm_idx on public.orders using gin (customer_name gin_trgm_ops);
create index if not exists orders_channel_idx   on public.orders (order_channel);
create index if not exists orders_date_idx      on public.orders (order_date desc);

create table if not exists public.order_items (
  order_code        text not null references public.orders(order_code) on delete cascade,
  sku               text not null,
  item_name         text,
  color             text,
  batch_code        text,
  ean               text,
  facility          text,
  package_code      text,
  sale_order_status text,
  tracking_number   text,
  order_date        timestamptz,
  dispatch_date     timestamptz,
  fulfillment_tat   timestamptz,
  delivery_time     timestamptz,
  shipping_provider text,
  selling_price     numeric(12,2),
  courier_status    text,
  tracking_status   text,
  primary key (order_code, sku)
);
create index if not exists order_items_awb_idx on public.order_items (tracking_number) where tracking_number is not null;

-- ---------------------------------------------------------------- sync runs
create table if not exists public.sync_runs (
  id            bigint generated always as identity primary key,
  source        text not null,          -- csv-import | sheet-sync
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  rows_read     int,
  orders_upserted int,
  items_upserted  int,
  rows_skipped  int,
  ok            boolean,
  notes         text
);

-- ---------------------------------------------------------------- audit log
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  entity      text not null,
  entity_id   text not null,
  action      text not null,
  changed_by  uuid references public.profiles(id),
  changes     jsonb,
  at          timestamptz not null default now()
);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id, at desc);

-- ---------------------------------------------------------------- RLS
-- All app data access goes through the server (service role). Browser keys get nothing.
alter table public.profiles    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.sync_runs   enable row level security;
alter table public.audit_log   enable row level security;

-- ---------------------------------------------------------------- search
-- Returns order codes matching a free-text query: phone, order ID, AWB or customer name.
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
