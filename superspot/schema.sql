-- SuperSpot production schema (Supabase / Postgres)
--
-- This app ships with an in-memory demo store (lib/db.ts) so it runs with
-- zero setup. To go to production, create these tables in Supabase and swap
-- the functions in lib/db.ts for supabase-js calls with the same signatures.

create extension if not exists "pgcrypto";

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  handle text,
  title text not null,
  description text default '',
  image text,
  favicon text,
  clicks bigint not null default 0,
  total_paid_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists featured_claims (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  spot smallint not null check (spot between 1 and 5),
  amount_cents bigint not null,
  duration_hours smallint not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null
);
-- Only one *active* claim per spot at a time; enforce in application logic
-- (steal = insert new row + the old one is simply superseded because it
-- reads `expires_at < now()` as inactive) or add a partial unique index
-- keyed off a `is_active` boolean column if you prefer strict DB enforcement.
create index if not exists featured_claims_spot_idx on featured_claims (spot, expires_at desc);

create table if not exists admin_settings (
  id int primary key default 1,
  base_prices_cents jsonb not null,
  duration_multipliers jsonb not null,
  max_duration_hours smallint not null default 72,
  outbid_premium_pct numeric not null default 15,
  banned_keywords text[] not null default '{}',
  banned_categories text[] not null default '{}',
  constraint single_row check (id = 1)
);

-- Row Level Security: public read on listings + settings, no public writes
-- (all writes should go through server-side API routes using the service
-- role key, after the Stripe webhook confirms payment).
alter table listings enable row level security;
alter table featured_claims enable row level security;
alter table admin_settings enable row level security;

create policy "listings are publicly readable" on listings for select using (true);
create policy "featured claims are publicly readable" on featured_claims for select using (true);
create policy "settings are publicly readable" on admin_settings for select using (true);

-- Enable Realtime on these tables in the Supabase dashboard (Database ->
-- Replication) to replace the client-side polling in app/page.tsx with
-- `supabase.channel(...).on('postgres_changes', ...)` subscriptions.
