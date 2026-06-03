create extension if not exists pgcrypto;

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  device_uuid_hash text not null,
  fingerprint_hash text not null,
  username text not null,
  is_admin boolean not null default false,
  user_agent text,
  first_ip inet,
  last_ip inet,
  session_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint devices_username_length_chk check (char_length(username) between 1 and 80),
  constraint devices_device_uuid_hash_unique unique (device_uuid_hash),
  constraint devices_fingerprint_hash_unique unique (fingerprint_hash)
);

drop table if exists votes;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  choices text[] not null default array['Yes', 'No']::text[],
  description text,
  event_date date not null default current_date,
  status text not null default 'OPEN',
  constraint events_name_length_chk check (char_length(name) between 1 and 160),
  constraint events_choices_not_empty_chk check (array_length(choices, 1) >= 1),
  constraint events_status_chk check (status in ('OPEN', 'CLOSED', 'COLLECTING', 'SETTLED'))
);

alter table events add column if not exists status text not null default 'OPEN';
alter table events add column if not exists event_date date not null default current_date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_status_chk'
  ) then
    alter table events
      add constraint events_status_chk check (status in ('OPEN', 'CLOSED', 'COLLECTING', 'SETTLED'));
  end if;
end $$;

create table if not exists event_voters (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  voter_id uuid not null references devices(id) on delete cascade,
  voted_choice integer not null default 0,
  constraint event_voters_voted_choice_non_negative_chk check (voted_choice >= 0),
  constraint event_voters_event_voter_choice_unique unique (event_id, voter_id, voted_choice)
);

alter table event_voters add column if not exists voted_choice integer not null default 0;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'event_voters_event_voter_unique'
  ) then
    alter table event_voters drop constraint event_voters_event_voter_unique;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_voters_voted_choice_non_negative_chk'
  ) then
    alter table event_voters
      add constraint event_voters_voted_choice_non_negative_chk check (voted_choice >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_voters_event_voter_choice_unique'
  ) then
    alter table event_voters
      add constraint event_voters_event_voter_choice_unique unique (event_id, voter_id, voted_choice);
  end if;
end $$;

create table if not exists billings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category text not null,
  total_amount numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint billings_category_length_chk check (char_length(category) between 1 and 120),
  constraint billings_total_amount_non_negative_chk check (total_amount >= 0)
);

create table if not exists billing_details (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid not null references billings(id) on delete cascade,
  username text not null,
  hours numeric(6, 2) not null default 0,
  amount numeric(14, 2) not null default 0,
  constraint billing_details_username_length_chk check (char_length(username) between 1 and 80),
  constraint billing_details_hours_non_negative_chk check (hours >= 0),
  constraint billing_details_amount_non_negative_chk check (amount >= 0)
);

create table if not exists event_debts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  username text not null,
  total_debt numeric(14, 2) not null default 0,
  status text not null default 'UNPAID',
  updated_at timestamptz not null default now(),
  constraint event_debts_username_length_chk check (char_length(username) between 1 and 80),
  constraint event_debts_total_debt_non_negative_chk check (total_debt >= 0),
  constraint event_debts_status_chk check (status in ('UNPAID', 'PAID')),
  constraint event_debts_event_username_unique unique (event_id, username)
);

alter table devices add column if not exists is_admin boolean not null default false;

create index if not exists devices_last_seen_at_idx on devices(last_seen_at);
create index if not exists events_event_date_idx on events(event_date);
create index if not exists event_voters_event_id_idx on event_voters(event_id);
create index if not exists event_voters_voter_id_idx on event_voters(voter_id);
create index if not exists event_voters_event_choice_idx on event_voters(event_id, voted_choice);
create index if not exists billings_event_id_idx on billings(event_id);
create index if not exists billing_details_billing_id_idx on billing_details(billing_id);
create index if not exists event_debts_event_id_idx on event_debts(event_id);
