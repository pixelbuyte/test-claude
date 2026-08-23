# SuperSpot

A pay-to-feature leaderboard: 5 timed "featured" spots at the top (rent them
for 6h / 12h / 24h / 3 days, steal them early by outbidding the current
occupant's remaining value), plus a permanent Outbid-style leaderboard below
where the highest total bid ranks highest, forever.

Built with Next.js 14 (App Router), Tailwind CSS, and Stripe Checkout. Ships
with a working **demo mode** (no Stripe keys, no database) so you can run it
immediately, plus a clear path to production with Supabase + real Stripe.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. Featured spot payments and leaderboard bids
complete instantly in demo mode — no Stripe account required to try it.

## Going to production

1. **Stripe** — set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (see
   `.env.example`). Point a Stripe webhook at `/api/webhook` for
   `checkout.session.completed`. Once `STRIPE_SECRET_KEY` is set, checkout
   redirects to real Stripe Checkout instead of settling instantly.
2. **Persistence** — the app currently keeps state in memory
   (`lib/db.ts`), which resets on every deploy/restart. `schema.sql` has the
   equivalent Postgres schema for Supabase, with RLS policies for public
   reads and comments on where to enable Realtime. Swap the functions in
   `lib/db.ts` for `supabase-js` calls — the function signatures are the
   integration surface the rest of the app already talks to.
3. **Admin auth** — `/admin` has no auth gate in this demo. Add one (a
   password cookie, or Supabase Auth) before exposing it publicly.
4. **Realtime** — replace the 8s polling in `app/page.tsx` with a Supabase
   Realtime subscription on `listings` / `featured_claims` once you're on
   Postgres.

## Customizing prices & durations

Everything lives in `lib/pricing.ts` (`DEFAULT_SETTINGS`) and is editable
live from `/admin`: base price per spot, duration multipliers, max allowed
duration, the steal/outbid premium percentage, and the banned-keyword /
banned-category content filter.

## Stack

- Next.js 14 App Router, TypeScript, Tailwind CSS
- Stripe Checkout + webhooks (test mode by default)
- Open Graph metadata scraping via `cheerio` for auto-populated previews
- Client-side polling for near-real-time updates (swap for Supabase
  Realtime in production)
