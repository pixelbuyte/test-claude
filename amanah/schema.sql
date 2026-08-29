-- Amanah production schema (Supabase / Postgres)
--
-- The app ships with an in-memory demo store (lib/db.ts) so it runs with zero
-- setup. For production, create these tables and swap the functions in
-- lib/db.ts for supabase-js calls with the same signatures.

create extension if not exists "pgcrypto";

create table if not exists tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

-- Each of the five permanent ranks is sold exactly once: rank is the primary
-- key, so a double-grant is impossible at the database level.
create table if not exists permanent_slots (
  rank smallint primary key check (rank between 1 and 5),
  tool_id uuid not null references tools(id) on delete restrict,
  price_cents bigint not null,
  stripe_session_id text unique,
  purchased_at timestamptz not null default now()
);

-- Short reservation while a Stripe Checkout for a permanent rank is pending,
-- so two buyers can't pay for the same rank at once. Expired holds are
-- ignored by reads and cleaned up lazily.
create table if not exists slot_holds (
  rank smallint primary key check (rank between 1 and 5),
  stripe_session_id text not null,
  expires_at timestamptz not null
);

create table if not exists boosts (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references tools(id) on delete cascade,
  hours smallint not null,
  price_cents bigint not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null
);
-- The homepage feed reads: active boosts ordered by most time remaining.
create index if not exists boosts_active_idx on boosts (expires_at desc);

-- Stripe retries webhook deliveries until it gets a 2xx; this table makes
-- grants idempotent across retries and across serverless instances.
create table if not exists processed_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

-- Completed payments for a rank that had meanwhile been sold to someone else
-- (hold expired, another buyer finished first). Nothing is granted; refund
-- these from the Stripe dashboard — fixed-price sales must deliver or return.
create table if not exists refunds_needed (
  stripe_session_id text primary key,
  rank smallint not null,
  tool_name text not null,
  created_at timestamptz not null default now()
);

-- Row Level Security: public read on the board tables, no public writes
-- (all writes go through server-side API routes using the service role key,
-- after the Stripe webhook confirms payment).
alter table tools enable row level security;
alter table permanent_slots enable row level security;
alter table slot_holds enable row level security;
alter table boosts enable row level security;
alter table processed_events enable row level security;
alter table refunds_needed enable row level security;

create policy "tools are publicly readable" on tools for select using (true);
create policy "permanent slots are publicly readable" on permanent_slots for select using (true);
create policy "boosts are publicly readable" on boosts for select using (true);
