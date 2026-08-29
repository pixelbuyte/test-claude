import Link from "next/link";
import type { Metadata } from "next";
import { BOOST_TIERS, PERMANENT_PRICES_CENTS, RANKS, formatUsd } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing — Amanah",
  description:
    "Fixed, public prices for permanent ranks and timed boosts. No bidding, no dynamic pricing.",
};

const PRINCIPLES: Array<[string, string]> = [
  [
    "One posted price for everyone",
    "Every price on this page is fixed and public. The first buyer and the hundredth buyer pay exactly the same amount — there is no negotiation and no premium for anyone.",
  ],
  [
    "No bidding, no gharar",
    "Auctions and outbidding create uncertainty about what you will pay and what you will get. Amanah sells defined placements — a specific rank forever, or a specific duration on the feed — at a known price, agreed before payment.",
  ],
  [
    "You get exactly what is described",
    "A permanent rank is yours permanently; a 24-hour boost runs for exactly 24 hours. Nobody can pay to take your placement away from you.",
  ],
  [
    "Delivered or refunded",
    "If a placement cannot be delivered as described — for example a permanent rank sells out while your payment is processing — the payment is refunded in full. We never keep money for something we did not deliver.",
  ],
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6">
      <section className="py-14 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-600">✦ Pricing ✦</p>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-5xl font-semibold text-emerald-900">
          Posted once. Paid once. Honored always.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink/65">
          Two ways onto the board, both at fixed prices. No bids, no surge, no haggling.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="card p-8">
          <h2 className="font-display text-2xl font-semibold text-emerald-900">Permanent ranks</h2>
          <p className="mt-1 text-sm text-ink/60">
            One-time payment. Each rank is sold exactly once and held forever.
          </p>
          <ul className="mt-6 divide-y divide-emerald-900/10">
            {RANKS.map((rank) => (
              <li key={rank} className="flex items-center justify-between py-4">
                <span className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-900 font-display text-gold-400">
                    {rank}
                  </span>
                  <span className="font-medium text-emerald-900">Rank {rank}</span>
                </span>
                <span className="font-mono text-lg text-emerald-900">
                  {formatUsd(PERMANENT_PRICES_CENTS[rank])}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/submit?type=permanent"
            className="mt-6 block rounded-full bg-emerald-900 px-5 py-2.5 text-center font-medium text-ivory transition hover:bg-emerald-800"
          >
            Claim a permanent rank
          </Link>
        </section>

        <section className="card p-8">
          <h2 className="font-display text-2xl font-semibold text-emerald-900">Timed boosts</h2>
          <p className="mt-1 text-sm text-ink/60">
            A fixed duration on the boost feed, right below the Permanent Five. Unlimited slots —
            the feed simply orders by time remaining.
          </p>
          <ul className="mt-6 divide-y divide-emerald-900/10">
            {BOOST_TIERS.map((tier) => (
              <li key={tier.hours} className="flex items-center justify-between py-4">
                <span className="flex items-center gap-3">
                  <span className="text-gold-500">✦</span>
                  <span className="font-medium text-emerald-900">{tier.label}</span>
                </span>
                <span className="font-mono text-lg text-emerald-900">{formatUsd(tier.cents)}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/submit?type=boost"
            className="mt-6 block rounded-full border border-emerald-900 px-5 py-2.5 text-center font-medium text-emerald-900 transition hover:bg-emerald-900 hover:text-ivory"
          >
            Start a boost
          </Link>
        </section>
      </div>

      <section className="mt-16">
        <div className="rule-gold mb-10" />
        <h2 className="text-center font-display text-3xl font-semibold text-emerald-900">
          Why fixed prices?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-ink/65">
          Amanah (أمانة) means <em>the trust</em>. The board is designed to be permissible and
          fair under Islamic commercial principles — which turn out to be exactly what makes any
          marketplace feel honest.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map(([title, text]) => (
            <div key={title} className="card p-6">
              <h3 className="font-display text-lg font-semibold text-emerald-900">
                <span className="mr-2 text-gold-500">✦</span>
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
