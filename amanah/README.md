# Amanah — أمانة

A public leaderboard for **AI agents and automation tools** with pay-to-rank
mechanics designed to be permissible under Islamic commercial principles:
every price is **fixed and posted**, there is **no bidding or outbidding**,
buyers get **exactly the placement described**, and anything that can't be
delivered is **refunded in full**.

Two products, both at posted prices:

- **Permanent ranks 1–5** — one-time purchase, sold exactly once, held forever.
  Rank 1 $4,500 · Rank 2 $3,000 · Rank 3 $2,200 · Rank 4 $1,600 · Rank 5 $1,200.
- **Timed boosts** — a fixed duration on the feed below the Permanent Five,
  ordered by time remaining. 6h $149 · 12h $249 · 24h $399 · 3d $899 · 7d $1,799.

Built with Next.js 14 (App Router), Tailwind CSS, and Stripe Checkout. Ships
with a working **demo mode** (no Stripe keys, no database) so it runs
immediately, plus a clear path to production with Supabase + real Stripe.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. In demo mode, submissions settle instantly with
no card involved, so the whole flow — homepage board, pricing, submit, pay,
success, placement appearing — is testable out of the box.

## Pages & API

| Route | What it does |
| --- | --- |
| `/` | The board: the Permanent Five, then active boosts sorted by remaining time (15s polling + live countdowns). |
| `/pricing` | Both price tables plus the fixed-price principles behind them. |
| `/submit` | Name + link + description, pick an open rank or a boost tier, pay. |
| `/success` | Post-payment confirmation. |
| `GET /api/board` | Board state: slots, holds, active boosts, demo flag. |
| `POST /api/checkout` | Validates the submission, derives the price server-side from the posted tables (never from the client), then settles instantly (demo) or creates a Stripe Checkout session. |
| `POST /api/webhook` | Grants placements on `checkout.session.completed`. Signature-verified, idempotent on event id. |

## Going to production

1. **Stripe** — set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (see
   `.env.example`). Add a webhook endpoint at
   `https://<your-domain>/api/webhook` subscribed to
   `checkout.session.completed`. Once the key is set, checkout redirects to
   real Stripe Checkout instead of settling instantly.

   `/api/webhook` refuses to run without `STRIPE_WEBHOOK_SECRET` — that
   endpoint is what grants placement, so an unsigned request must never be
   trusted. It also de-duplicates on Stripe's event id, since Stripe retries
   deliveries until it gets a 2xx.

2. **Persistence** — the app keeps state in memory (`lib/db.ts`), which
   resets on every deploy/restart. `schema.sql` has the equivalent Postgres
   schema for Supabase (RLS included). Swap the functions in `lib/db.ts` for
   `supabase-js` calls — the function signatures are the integration surface
   the rest of the app talks to. Note the schema makes double-selling a rank
   impossible at the DB level (`rank` is the primary key).

3. **Refund queue** — when a permanent rank's checkout hold expires and a
   second buyer completes payment after the rank sold, nothing is granted and
   the payment lands in `refundsNeeded` (`refunds_needed` in Postgres) with a
   `console.error`. Refund those sessions from the Stripe dashboard — the
   fixed-price promise is deliver-or-refund.

## The permanence & fairness mechanics

- Prices live in one place, `lib/pricing.ts`, and the server derives every
  charge from those tables. A tampered client request cannot change what is
  paid or what is granted.
- A permanent rank purchase places a 30-minute **hold** on the rank while the
  buyer is on the Stripe payment page, so two people can't buy the same rank
  at once. Holds expire automatically; the webhook re-checks before granting.
- Boosts have unlimited inventory by design — the feed orders by remaining
  time, so no boost ever displaces another. Nothing on the board can be taken
  from its holder by paying more.
