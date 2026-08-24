-- AgentRank schema. Run this once in the Supabase SQL editor (or via
-- `supabase db push`). Expiry is enforced at query time by the app's ranking
-- engine, so the board is always correct even without any cron job; the
-- cleanup function below is optional tidying.

create extension if not exists pgcrypto;

-- ── Categories ─────────────────────────────────────────────────────────────
create table if not exists categories (
  slug text primary key,
  name text not null,
  sort integer not null default 0
);

insert into categories (slug, name, sort) values
  ('ai_agents', 'AI Agents', 1),
  ('workflow_automation', 'Workflow Automation', 2),
  ('customer_support', 'Customer Support Agents', 3),
  ('coding_agents', 'Coding Agents', 4),
  ('sales_agents', 'Sales Agents', 5),
  ('other', 'Other', 6)
on conflict (slug) do nothing;

-- ── Listings ───────────────────────────────────────────────────────────────
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  url text not null,
  description text not null default '' check (char_length(description) <= 120),
  logo_url text,
  category text not null default 'other' references categories (slug),
  status text not null default 'active'
    check (status in ('pending', 'active', 'rejected')),

  -- Permanent slot ownership (ranks 1–5). The partial unique index makes it
  -- impossible for two listings to hold the same rank, even under races.
  permanent_rank integer check (permanent_rank between 1 and 5),

  -- Timed tier boost. Expiry is checked at read time: an expired boost simply
  -- stops counting, which is what makes boosts "expire automatically".
  boost_tier text check (boost_tier in ('top10', 'top20', 'top50')),
  boost_started_at timestamptz,
  boost_expires_at timestamptz,

  highlight_expires_at timestamptz,
  featured_open_expires_at timestamptz,

  click_count integer not null default 0,
  owner_email text,
  created_at timestamptz not null default now()
);

create unique index if not exists listings_permanent_rank_key
  on listings (permanent_rank)
  where permanent_rank is not null;

create index if not exists listings_status_idx on listings (status);

-- Dedup key for "is this URL already listed": host without www, path
-- without a trailing slash, query/hash dropped, lowercased. Mirrors
-- urlMatchKey() in src/lib/utils.ts — keep the two in sync. Added via
-- ALTER (not inline in CREATE TABLE) so it also lands on a database that
-- was already provisioned before this column existed — `create table if
-- not exists` is a no-op on an existing table and would otherwise skip it.
alter table listings add column if not exists url_key text generated always as (
  lower(
    regexp_replace(
      regexp_replace(regexp_replace(url, '[?#].*$', ''), '^https?://(www\.)?', ''),
      '/+$', ''
    )
  )
) stored;

create index if not exists listings_url_key_idx on listings (url_key);
create index if not exists listings_boost_idx
  on listings (boost_tier, boost_expires_at)
  where boost_tier is not null;

-- ── Payments ───────────────────────────────────────────────────────────────
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings (id) on delete set null,
  stripe_session_id text unique,
  stripe_payment_intent text,
  sku text not null,
  amount_cents integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'conflict', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists payments_status_idx on payments (status);

-- ── Live visitor presence ──────────────────────────────────────────────────
create table if not exists presence (
  anon_id text primary key,
  seen_at timestamptz not null default now()
);

create index if not exists presence_seen_idx on presence (seen_at);

-- ── Settings (free-form key/value for future toggles) ──────────────────────
create table if not exists settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

-- ── Click tracking ─────────────────────────────────────────────────────────
-- Atomically increments and returns the target URL so the redirect route is
-- a single round trip.
create or replace function increment_click(listing_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target text;
begin
  update listings
     set click_count = click_count + 1
   where id = listing_id
     and status = 'active'
  returning url into target;
  return target;
end;
$$;

-- ── Atomic tier-boost claim ────────────────────────────────────────────────
-- Capacity check and boost write in one serialized step, so two webhooks
-- racing for the last slot in a tier can never both win. The advisory lock
-- keys on the tier name and is released when the transaction ends.
create or replace function apply_tier_boost(
  p_listing_id uuid,
  p_tier text,
  p_capacity integer,
  p_started_at timestamptz,
  p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('agentrank_boost_' || p_tier));
  if (
    select count(*)
      from listings
     where status = 'active'
       and boost_tier = p_tier
       and boost_expires_at > now()
       and permanent_rank is null
       and id <> p_listing_id
  ) >= p_capacity then
    return false;
  end if;
  update listings
     set boost_tier = p_tier,
         boost_started_at = p_started_at,
         boost_expires_at = p_expires_at,
         status = 'active'
   where id = p_listing_id;
  return true;
end;
$$;

-- ── Optional tidy-up (safe to schedule with pg_cron, e.g. hourly) ──────────
create or replace function clear_expired_placements()
returns void
language sql
security definer
set search_path = public
as $$
  update listings
     set boost_tier = null,
         boost_started_at = null,
         boost_expires_at = null
   where boost_expires_at is not null
     and boost_expires_at < now();

  update listings
     set highlight_expires_at = null
   where highlight_expires_at is not null
     and highlight_expires_at < now();

  update listings
     set featured_open_expires_at = null
   where featured_open_expires_at is not null
     and featured_open_expires_at < now();

  delete from presence where seen_at < now() - interval '1 hour';
$$;

-- To schedule it (requires the pg_cron extension, available on Supabase):
--   select cron.schedule('agentrank-cleanup', '17 * * * *',
--     $$select clear_expired_placements()$$);

-- ── Row Level Security ─────────────────────────────────────────────────────
-- The app talks to the database exclusively through the service-role key on
-- the server. RLS stays on as defense in depth: with the anon key you can
-- only read active listings and categories.
alter table listings enable row level security;
alter table payments enable row level security;
alter table presence enable row level security;
alter table settings enable row level security;
alter table categories enable row level security;

create policy "public can read active listings" on listings
  for select using (status = 'active');

-- owner_email is customer PII: column-level grants keep it out of reach of
-- the anon/authenticated roles even though the row policy allows the row.
revoke select on listings from anon, authenticated;
grant select (
  id, name, url, description, logo_url, category, status,
  permanent_rank, boost_tier, boost_started_at, boost_expires_at,
  highlight_expires_at, featured_open_expires_at, click_count, created_at
) on listings to anon, authenticated;

create policy "public can read categories" on categories
  for select using (true);
