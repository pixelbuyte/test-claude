import { ArrowRight, BadgeCheck, Landmark, Timer } from "lucide-react";
import Link from "next/link";

import { Board } from "@/components/board";
import { StatsBar } from "@/components/stats";
import {
  demoMode,
  getActiveListings,
  getLiveVisitorCount,
  getPermanentRankOwners,
  getTotalRevenueCents,
} from "@/lib/db";
import {
  CATALOG,
  formatUsd,
  PERMANENT_ITEMS,
  TIER_ITEMS,
  TIER_LABEL,
  type Tier,
} from "@/lib/pricing";
import { rankBoard } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [listings, permanentOwners] = await Promise.all([
    getActiveListings(),
    getPermanentRankOwners().catch(() => ({})),
  ]);
  const entries = rankBoard(listings, new Date(), permanentOwners);
  const liveVisitors = await getLiveVisitorCount().catch(() => 0);
  const showRevenue = process.env.NEXT_PUBLIC_SHOW_REVENUE === "true" || demoMode();
  const totalRevenueCents = showRevenue
    ? await getTotalRevenueCents().catch(() => 0)
    : null;

  const totalClicks = listings.reduce((sum, l) => sum + l.clickCount, 0);

  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium tracking-wide text-muted">
          <BadgeCheck className="h-3.5 w-3.5 text-tier50" />
          Fixed prices · fixed durations · no auctions, ever
        </p>
        <h1 className="mt-6 max-w-3xl font-display text-4xl leading-[1.08] font-semibold tracking-tight sm:text-6xl">
          The public leaderboard for{" "}
          <span className="text-gold">any site or tool</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Every placement has a clear, published price — a permanent rank or a
          timed spot in a tier. Nobody can outbid you, and money never reorders
          listings inside a tier. Fair, transparent, simple.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/pricing#permanent"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90"
          >
            Buy a permanent rank
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing#timed"
            className="rounded-full border border-border px-6 py-3 text-sm font-semibold transition-colors hover:border-border-strong hover:bg-raised"
          >
            Buy a timed placement
          </Link>
          <Link
            href="/submit"
            className="px-2 py-3 text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            or list for free →
          </Link>
        </div>
      </section>

      {/* Stats */}
      <div className="mx-auto mb-12 max-w-6xl px-4 sm:px-6">
        <StatsBar
          totalListings={listings.length}
          totalClicks={totalClicks}
          liveVisitors={liveVisitors}
          totalRevenueCents={totalRevenueCents}
        />
      </div>

      {/* The board */}
      <Board entries={entries} demoMode={demoMode()} />

      {/* How it works */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          How ranking works
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Three ways onto the board — all with published fixed prices, none
          with bidding.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <Landmark className="h-6 w-6 text-gold" />
            <h3 className="mt-4 font-display text-lg font-semibold">
              1 · Permanent Top 5
            </h3>
            <p className="mt-2 text-sm text-muted">
              A one-time payment buys a specific rank, #1–#5. It stays yours
              until you cancel. Sold slots show as “Owned” — no one can pay to
              take your position.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <Timer className="h-6 w-6 text-tier10" />
            <h3 className="mt-4 font-display text-lg font-semibold">
              2 · Timed tiers
            </h3>
            <p className="mt-2 text-sm text-muted">
              Buy a guaranteed place inside the Top 10, Top 20, or Top 50 for a
              fixed duration. Inside a tier, order is first come, first served —
              never who paid more. Placements expire automatically.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <BadgeCheck className="h-6 w-6 text-tier50" />
            <h3 className="mt-4 font-display text-lg font-semibold">
              3 · Open section
            </h3>
            <p className="mt-2 text-sm text-muted">
              Anyone can list any site, tool, or profile for free, forever —
              just paste the link. Free listings rank by real outbound clicks,
              and an optional “Featured” badge adds extra visibility.
            </p>
          </div>
        </div>

        {/* Full fixed price table */}
        <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-130 text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs tracking-wide text-faint uppercase">
                <th className="px-5 py-3.5 font-medium">Placement</th>
                <th className="px-5 py-3.5 font-medium">Duration</th>
                <th className="px-5 py-3.5 text-right font-medium">
                  Fixed price
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERMANENT_ITEMS.map((item) => (
                <tr key={item.sku}>
                  <td className="px-5 py-3 font-medium text-gold">
                    Permanent Rank #{item.rank}
                  </td>
                  <td className="px-5 py-3 text-muted">Until cancelled</td>
                  <td className="px-5 py-3 text-right font-display font-semibold tabular-nums">
                    {formatUsd(item.amountCents)}
                  </td>
                </tr>
              ))}
              {(["top10", "top20", "top50"] as Tier[]).flatMap((tier) =>
                TIER_ITEMS(tier).map((item) => (
                  <tr key={item.sku}>
                    <td className="px-5 py-3">{TIER_LABEL[tier]} tier</td>
                    <td className="px-5 py-3 text-muted">
                      {item.label.split("·")[1]?.trim()}
                    </td>
                    <td className="px-5 py-3 text-right font-display font-semibold tabular-nums">
                      {formatUsd(item.amountCents)}
                    </td>
                  </tr>
                )),
              )}
              {CATALOG.filter(
                (i) => i.kind === "highlight" || i.kind === "featured_open",
              ).map((item) => (
                <tr key={item.sku}>
                  <td className="px-5 py-3">
                    {item.kind === "highlight"
                      ? "Highlight / Pin"
                      : "Featured in Open Section"}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {item.label.split("·")[1]?.trim()}
                  </td>
                  <td className="px-5 py-3 text-right font-display font-semibold tabular-nums">
                    {formatUsd(item.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Every price above is final and public.{" "}
          <Link href="/rules" className="underline underline-offset-4">
            Read the full ranking rules
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
