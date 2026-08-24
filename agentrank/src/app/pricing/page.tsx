import type { Metadata } from "next";

import { PricingSections } from "@/components/pricing-client";
import { getActiveListings, getPermanentRankOwners } from "@/lib/db";
import type { Tier } from "@/lib/pricing";
import { countActiveBoosts } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Every UPrank placement has a fixed, published price — permanent ranks, timed tier placements, and highlights. No auctions.",
};

export default async function PricingPage() {
  const [listings, permanentOwners] = await Promise.all([
    getActiveListings().catch(() => []),
    getPermanentRankOwners().catch(() => ({})),
  ]);
  const now = new Date();
  const tierCounts: Record<Tier, number> = {
    top10: countActiveBoosts(listings, "top10", now),
    top20: countActiveBoosts(listings, "top20", now),
    top50: countActiveBoosts(listings, "top50", now),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-14 pb-8 sm:px-6">
      <div className="mb-12 max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Simple, fixed pricing
        </h1>
        <p className="mt-3 text-lg text-muted">
          You always see the exact amount before paying, and the amount never
          changes based on demand or other buyers. This is not an auction — by
          design.
        </p>
      </div>
      <PricingSections permanentOwners={permanentOwners} tierCounts={tierCounts} />
    </div>
  );
}
