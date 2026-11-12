-- Tickets (enquiries & complaints), contact log, notes, SLA settings.

-- ---------------------------------------------------------------- SLA settings (admin-editable; snapshotted on each ticket)
create table if not exists public.sla_settings (
  key         text primary key,
  hours       numeric not null check (hours > 0),
  label       text not null,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);
insert into public.sla_settings (key, hours, label) values
  ('enquiry', 24, 'Enquiry: resolve within'),
  ('complaint', 48, 'Complaint: resolve within'),
  ('evidence_followup', 24, 'Awaiting evidence becomes "Follow up for evidence" after'),
  ('evidence_attention', 48, 'Awaiting evidence needs attention after')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- ticket codes: {C|E}-{channel}-{YYMM}-{seq}
create table if not exists public.ticket_counters (
  period text primary key,
  last   int not null
);

create or replace function public.next_ticket_code(p_type text, p_channel text)
returns text language plpgsql volatile set search_path = public as $$
declare
  per text := to_char(now() at time zone 'Asia/Kolkata', 'YYMM');
  n   int;
begin
  insert into ticket_counters (period, last) values (per, 1)
  on conflict (period) do update set last = ticket_counters.last + 1
  returning last into n;
  return upper(left(p_type, 1)) || '-' || p_channel || '-' || per || '-' || lpad(n::text, 4, '0');
end $$;

-- ---------------------------------------------------------------- tickets
create table if not exists public.tickets (
  id                    bigint generated always as identity primary key,
  code                  text not null unique,
  type                  text not null check (type in ('enquiry', 'complaint')),
  converted_at          timestamptz,

  -- order & customer
  order_channel         text not null,
  order_code            text,
  order_in_data         boolean not null default false,
  customer_name         text,
  phone                 text,
  alt_phone             text,
  email                 text,
  address               text,
  pincode               text,

  -- issue
  source                text not null,
  source_detail         text,
  category              text not null,          -- enquiry type or complaint type
  details               text,

  -- workflow
  status                text not null default 'Open',
  awaiting_evidence_since timestamptz,
  outcome               text,                   -- enquiry closing response
  resolution            text,
  resolution_details    jsonb not null default '{}',
  review_status         text,

  -- marketplace panel
  marketplace_request_id text,
  panel_action          text,
  panel_comments        text,
  panel_updated_at      timestamptz,
  policy_exception      boolean not null default false,

  -- people
  owner_id              uuid references public.profiles(id),
  temp_owner_id         uuid references public.profiles(id),
  temp_owner_from       timestamptz,
  temp_owner_to         timestamptz,
  created_by            uuid references public.profiles(id),

  -- links
  parent_ticket_id      bigint references public.tickets(id),
  previous_ticket_id    bigint references public.tickets(id),

  -- follow-up & clocks
  next_followup_at      timestamptz,
  next_followup_reason  text,
  sla_hours             numeric not null,
  customer_wait_seconds bigint not null default 0,
  pause_started_at      timestamptz,
  pause_until           timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  resolved_at           timestamptz,
  closed_at             timestamptz,
  is_closed             boolean not null default false
);
create index if not exists tickets_phone_idx     on public.tickets (phone) where phone is not null;
create index if not exists tickets_order_idx     on public.tickets (order_code) where order_code is not null;
create index if not exists tickets_owner_idx     on public.tickets (owner_id, is_closed, next_followup_at);
create index if not exists tickets_temp_owner_idx on public.tickets (temp_owner_id) where temp_owner_id is not null;
create index if not exists tickets_open_idx      on public.tickets (is_closed, next_followup_at);
create index if not exists tickets_parent_idx    on public.tickets (parent_ticket_id) where parent_ticket_id is not null;
create index if not exists tickets_email_idx     on public.tickets (lower(email)) where email is not null;

create table if not exists public.ticket_items (
  ticket_id  bigint not null references public.tickets(id) on delete cascade,
  sku        text not null,
  item_name  text,
  primary key (ticket_id, sku)
);

create table if not exists public.ticket_contacts (
  id         bigint generated always as identity primary key,
  ticket_id  bigint not null references public.tickets(id) on delete cascade,
  at         timestamptz not null default now(),
  by         uuid references public.profiles(id),
  direction  text not null check (direction in ('Inbound', 'Outbound')),
  mode       text not null,
  outcome    text not null check (outcome in ('Answered', 'Not responded', 'Not reachable')),
  note       text
);
create index if not exists ticket_contacts_ticket_idx on public.ticket_contacts (ticket_id, at);

create table if not exists public.ticket_notes (
  id         bigint generated always as identity primary key,
  ticket_id  bigint not null references public.tickets(id) on delete cascade,
  at         timestamptz not null default now(),
  by         uuid references public.profiles(id),
  body       text not null
);
create index if not exists ticket_notes_ticket_idx on public.ticket_notes (ticket_id, at);

alter table public.sla_settings    enable row level security;
alter table public.ticket_counters enable row level security;
alter table public.tickets         enable row level security;
alter table public.ticket_items    enable row level security;
alter table public.ticket_contacts enable row level security;
alter table public.ticket_notes    enable row level security;

-- ---------------------------------------------------------------- live view: clocks, deadline, SLA flag
create or replace view public.ticket_view as
with base as (
  select t.*,
    (t.customer_wait_seconds
      + case when t.pause_started_at is not null
          then greatest(0, extract(epoch from (least(now(), coalesce(t.pause_until, now())) - t.pause_started_at)))
          else 0 end)::bigint as wait_seconds_now,
    (select hours from sla_settings where key = 'evidence_followup') as ev_followup_h,
    (select hours from sla_settings where key = 'evidence_attention') as ev_attention_h
  from tickets t
), d as (
  select b.*,
    b.created_at + make_interval(secs => b.sla_hours * 3600 + b.wait_seconds_now) as deadline
  from base b
)
select d.*,
  case when d.status = 'Awaiting evidence' and d.awaiting_evidence_since < now() - make_interval(secs => d.ev_followup_h * 3600)
       then 'Follow up for evidence' else d.status end as display_status,
  case
    when d.status = 'Resolved' or d.is_closed then
      case when coalesce(d.resolved_at, d.closed_at) <= d.deadline then 'met' else 'missed' end
    when now() > d.deadline then 'delayed'
    when d.next_followup_at is null
      or d.next_followup_at < now()
      or d.deadline - now() < make_interval(secs => d.sla_hours * 3600 * 0.25)
      or (d.status = 'Awaiting evidence' and d.awaiting_evidence_since < now() - make_interval(secs => d.ev_attention_h * 3600))
      then 'attention'
    else 'on_track'
  end as sla_flag,
  (select count(*) from ticket_contacts c where c.ticket_id = d.id) as contacts_total,
  (select count(*) from ticket_contacts c where c.ticket_id = d.id and c.outcome = 'Answered') as contacts_answered,
  (select c.outcome from ticket_contacts c where c.ticket_id = d.id order by c.at desc limit 1) as last_contact_outcome,
  (select c.at from ticket_contacts c where c.ticket_id = d.id order by c.at desc limit 1) as last_contact_at,
  po.full_name as owner_name,
  pt.full_name as temp_owner_name
from d
left join profiles po on po.id = d.owner_id
left join profiles pt on pt.id = d.temp_owner_id;

revoke all on public.ticket_view from public, anon, authenticated;
grant select on public.ticket_view to service_role;
revoke all on function public.next_ticket_code(text, text) from public, anon, authenticated;
grant execute on function public.next_ticket_code(text, text) to service_role;
