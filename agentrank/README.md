# UPrank

**The fixed-price public leaderboard for any site or tool.**

UPrank is a pay-to-rank board designed to be *Islamic-permissible*: there
is **no bidding, no auction, and no price competition of any kind**. Every
placement is a published fixed price for a fixed rank or a fixed duration —
like buying a sponsored ad slot. Rank among timed listings is **never**
decided by who paid more.

## How ranking works

1. **Permanent Top 5** — a one-time fixed payment buys a specific rank
   (#1 $4,500 · #2 $3,000 · #3 $2,200 · #4 $1,600 · #5 $1,200). It stays
   with its owner until they cancel.
2. **Timed tier placements** — a fixed price buys a guaranteed place inside
   the Top 10 (5 slots), Top 20 (10 slots), or Top 50 (30 slots) for a fixed
   duration. Within a tier, order is **first come, first served**. Placements
   expire automatically.
3. **Open section** — free listings for anyone, ranked by real outbound
   clicks. Optional "Featured" badge ($49 / 24 h, $149 / 7 d).
4. **Highlight / Pin** ($149 / 24 h, $349 / 3 d, $599 / 7 d) adds visual
   emphasis only — it never changes rank.

Both extras carry a live preview on the pricing page and inside the buy
dialog (`src/components/listing-preview.tsx`) that renders a real board row
in its normal, highlighted, and featured states, so buyers can see exactly
what the money buys before paying.

All of this is enforced in code: pricing in [`src/lib/pricing.ts`](src/lib/pricing.ts),
ordering in [`src/lib/ranking.ts`](src/lib/ranking.ts).

## Buying a placement

Every buy dialog asks for exactly one thing: **the site's URL**. On checkout,
the server (`src/app/api/checkout/route.ts`) looks that URL up:

- **Already listed?** The placement is applied to that listing in place —
  never a duplicate.
- **New?** A listing is created automatically. Its name, description, and
  logo are scraped from the page (`src/lib/site-metadata.ts`, with a
  hostname-derived fallback if the fetch fails or times out), and a starting
  category is guessed from keywords in the scraped text — correctable
  anytime from `/admin`.

Categories are general-purpose (SaaS & Tools, AI & Automation, Directories &
Marketplaces, Communities & Forums, Blogs & Content, Business & Services,
Other) — any kind of site or tool fits somewhere.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Supabase** (Postgres) — schema in [`supabase/schema.sql`](supabase/schema.sql)
- **Stripe** — one-time payments via Checkout Sessions + webhook activation;
  all products/prices/payment links already exist
  ([`docs/stripe-catalog.md`](docs/stripe-catalog.md))
- **Resend** (optional) for confirmation emails
- Dark mode by default with a light-mode toggle; fully responsive

Without env vars the site runs in **demo mode**: fictional listings render
the full board, and buy buttons fall back to the live Stripe Payment Links.

## Setup

### 1. Clone & install

```bash
git clone <this-repo>
cd agentrank  # the app's directory name is unchanged; only the brand is UPrank
npm install
cp .env.example .env.local
npm run dev
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run the whole of `supabase/schema.sql`.
3. Copy **Project URL**, **anon key**, and **service_role key** from
   *Project Settings → API* into `.env.local`.
4. (Optional) Enable `pg_cron` and schedule `clear_expired_placements()`
   hourly — the board is correct without it (expiry is checked at read
   time); the job only tidies stale rows.

### 3. Stripe

1. The 23 products, prices, and payment links already exist in the connected
   account — nothing to create. If you use a different Stripe account, create
   equivalents and update `src/lib/pricing.ts`.
2. Put your **secret key** in `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint: *Developers → Webhooks → Add endpoint* →
   `https://yourdomain.com/api/webhooks/stripe`, subscribed to
   `checkout.session.completed`. Put its signing secret in
   `STRIPE_WEBHOOK_SECRET`.
4. Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### 4. Deploy to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new) and set the
   **Root Directory** to `agentrank/` (this app lives in a subdirectory).
2. Add every variable from `.env.example` in *Project → Settings →
   Environment Variables*.
3. Deploy. Set `NEXT_PUBLIC_SITE_URL` to the final URL and redeploy.

### 5. Custom domain

*Vercel → Project → Settings → Domains* → add your domain and point its DNS
(CNAME `cname.vercel-dns.com` or the offered A records). Update
`NEXT_PUBLIC_SITE_URL` and the Stripe webhook URL to match.

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side database access |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Reserved for client-side Stripe.js |
| `RESEND_API_KEY` | Optional — confirmation emails |
| `EMAIL_FROM` | Optional — from address for emails |
| `ADMIN_PASSWORD` | Enables `/admin` |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for checkout redirects |
| `NEXT_PUBLIC_SHOW_REVENUE` | `"true"` shows the public revenue counter |
| `REQUIRE_LISTING_REVIEW` | `"true"` holds free listings for review |

## App map

| Route | What it does |
|---|---|
| `/` | Live board: permanents → Top 10 → Top 20 → Top 50 → open section, with category filters, search, live visitor counter |
| `/pricing` | Full fixed-price list with real-time availability and checkout |
| `/submit` | Free listing form |
| `/rules` | The ranking rules, in plain language |
| `/success` | Post-checkout confirmation |
| `/admin` | Password-protected dashboard: approve/reject listings, clear placements, payments & revenue |
| `/go/:id` | Click-tracked outbound redirect |
| `/api/checkout` | Creates a Stripe Checkout Session (price always from the server catalog) |
| `/api/webhooks/stripe` | Activates purchases after payment; races are flagged, never double-sold |

## Guarantees enforced in code

- The client sends a SKU, never an amount — prices come only from the server
  catalog.
- Timed placements are ordered by activation time within their tier; the
  ranking engine has no code path that sorts by amount paid.
- Expiry is evaluated at read time, so boosts drop off the instant they end
  even with no cron running.
- A partial unique index guarantees a permanent rank can never be assigned
  twice; a losing race is flagged `conflict` for a full refund.
- Tier capacity (5/10/30) is checked at checkout and claimed atomically at
  webhook time by a Postgres function holding an advisory lock — two
  concurrent buyers can never oversell a tier.
- The webhook claims each payment exactly once before applying it, so
  Stripe's at-least-once delivery can never double-extend a placement.
- A cheap purchase can never downgrade another listing's active higher-tier
  placement, and payment never reinstates a rejected listing.
