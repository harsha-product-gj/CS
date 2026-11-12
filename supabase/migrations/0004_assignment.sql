-- Assignment: processes, daily roster, round-robin pointer, edit-access requests, missed-call imports.

create table if not exists public.processes (
  id          text primary key,              -- slug
  name        text not null,
  sort        int not null default 0,
  active      boolean not null default true
);
insert into public.processes (id, name, sort) values
  ('inbound', 'Inbound calls', 1),
  ('missed', 'Missed calls', 2),
  ('whatsapp', 'WhatsApp', 3),
  ('email', 'Email', 4),
  ('amazon', 'Amazon', 5),
  ('flipkart', 'Flipkart', 6),
  ('social', 'Social media', 7)
on conflict (id) do nothing;

-- Who works which processes on which day (IST date).
create table if not exists public.roster_entries (
  day         date not null,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  process_id  text not null references public.processes(id) on delete cascade,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  primary key (day, user_id, process_id)
);
create index if not exists roster_day_process_idx on public.roster_entries (day, process_id);

-- Last person given work, per pool, so round-robin continues fairly across uploads.
create table if not exists public.round_robin (
  pool          text primary key,
  last_user_id  uuid references public.profiles(id) on delete set null,
  updated_at    timestamptz not null default now()
);

create table if not exists public.edit_requests (
  id           bigint generated always as identity primary key,
  ticket_id    bigint not null references public.tickets(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  reason       text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by   uuid references public.profiles(id),
  decided_at   timestamptz,
  access_until timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists edit_requests_status_idx on public.edit_requests (status, created_at);

create table if not exists public.missed_call_imports (
  id           bigint generated always as identity primary key,
  uploaded_by  uuid references public.profiles(id),
  uploaded_at  timestamptz not null default now(),
  rows_total   int,
  created      int,
  attached     int,
  skipped      int,
  notes        jsonb
);

alter table public.processes           enable row level security;
alter table public.roster_entries      enable row level security;
alter table public.round_robin         enable row level security;
alter table public.edit_requests       enable row level security;
alter table public.missed_call_imports enable row level security;
