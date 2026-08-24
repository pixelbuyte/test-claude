/**
 * The AgentRank ranking engine.
 *
 * Strict ordering rules — enforced here and nowhere else:
 *
 *   1. Permanent ranks 1–5 always sit at the very top, in their fixed
 *      positions. Unsold permanent slots render as "available" placeholders.
 *   2. Active Top 10 boosts come next, ordered first-come-first-served
 *      (earliest activation first). A new buyer never displaces an existing
 *      boost holder — they join the queue below.
 *   3. Active Top 20 boosts, same ordering.
 *   4. Active Top 50 boosts, same ordering.
 *   5. Free open listings at the bottom: featured listings first, then by
 *      real outbound click count, then newest.
 *
 * Temporary listings are NEVER ordered by the amount of money paid. That is
 * the core fairness rule of the fixed-price model — do not "optimize" it.
 */

import type { Tier } from "@/lib/pricing";
import { PERMANENT_ITEMS } from "@/lib/pricing";
import type { Listing } from "@/lib/types";

export type BoardEntry =
  | {
      type: "listing";
      rank: number;
      listing: Listing;
      placement: Placement;
      highlighted: boolean;
    }
  | {
      type: "open_slot";
      rank: number;
      /** The unsold permanent rank this placeholder represents (1–5). */
      permanentRank: number;
      priceCents: number;
      /** False when the rank is held by a non-active (pending/rejected)
       * listing — still unavailable, but with nobody to publicly credit. */
      available: boolean;
    };

export type Placement =
  | { kind: "permanent"; rank: number }
  | { kind: "boost"; tier: Tier; expiresAt: string }
  | { kind: "free"; featured: boolean };

const TIER_ORDER: Tier[] = ["top10", "top20", "top50"];

function isActive(iso: string | null, now: Date): boolean {
  return iso !== null && new Date(iso).getTime() > now.getTime();
}

export function hasActiveBoost(listing: Listing, now: Date): boolean {
  return listing.boostTier !== null && isActive(listing.boostExpiresAt, now);
}

export function isHighlighted(listing: Listing, now: Date): boolean {
  return isActive(listing.highlightExpiresAt, now);
}

export function isFeaturedOpen(listing: Listing, now: Date): boolean {
  return isActive(listing.featuredOpenExpiresAt, now);
}

/**
 * Orders active listings into the public board. Pure and deterministic:
 * (listings, now) → entries with global rank numbers.
 *
 * `permanentRankHeldBy` covers ranks held by a non-active (pending/rejected)
 * listing — those don't appear in `listings` (which is active-only) but are
 * still unavailable in the database, so the placeholder must say
 * "unavailable" rather than falsely inviting a purchase that would 409.
 */
export function rankBoard(
  listings: Listing[],
  now: Date,
  permanentRankHeldBy: Partial<Record<number, unknown>> = {},
): BoardEntry[] {
  const active = listings.filter((l) => l.status === "active");
  const entries: BoardEntry[] = [];
  const placed = new Set<string>();
  let rank = 1;

  // 1. Permanent ranks 1–5, with placeholders for unsold slots.
  for (const item of PERMANENT_ITEMS) {
    const owner = active.find((l) => l.permanentRank === item.rank);
    if (owner) {
      placed.add(owner.id);
      entries.push({
        type: "listing",
        rank: rank++,
        listing: owner,
        placement: { kind: "permanent", rank: item.rank! },
        highlighted: isHighlighted(owner, now),
      });
    } else {
      entries.push({
        type: "open_slot",
        rank: rank++,
        permanentRank: item.rank!,
        priceCents: item.amountCents,
        available: permanentRankHeldBy[item.rank!] === undefined,
      });
    }
  }

  // 2–4. Tier boosts, first-come-first-served within each tier.
  for (const tier of TIER_ORDER) {
    const boosted = active
      .filter(
        (l) => !placed.has(l.id) && l.boostTier === tier && hasActiveBoost(l, now),
      )
      .sort((a, b) => {
        const startDiff =
          new Date(a.boostStartedAt ?? a.createdAt).getTime() -
          new Date(b.boostStartedAt ?? b.createdAt).getTime();
        if (startDiff !== 0) return startDiff;
        return a.id.localeCompare(b.id);
      });
    for (const listing of boosted) {
      placed.add(listing.id);
      entries.push({
        type: "listing",
        rank: rank++,
        listing,
        placement: {
          kind: "boost",
          tier,
          expiresAt: listing.boostExpiresAt!,
        },
        highlighted: isHighlighted(listing, now),
      });
    }
  }

  // 5. Free open listings: featured first, then clicks, then newest.
  const free = active
    .filter((l) => !placed.has(l.id))
    .sort((a, b) => {
      const featDiff =
        Number(isFeaturedOpen(b, now)) - Number(isFeaturedOpen(a, now));
      if (featDiff !== 0) return featDiff;
      if (b.clickCount !== a.clickCount) return b.clickCount - a.clickCount;
      const timeDiff =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });
  for (const listing of free) {
    entries.push({
      type: "listing",
      rank: rank++,
      listing,
      placement: { kind: "free", featured: isFeaturedOpen(listing, now) },
      highlighted: isHighlighted(listing, now),
    });
  }

  return entries;
}

/** Concurrent active boosts per tier — used for capacity checks. Permanent
 * owners are excluded: they are placed in ranks 1–5 regardless, so a stale
 * boost on one must not consume a tier slot. */
export function countActiveBoosts(
  listings: Listing[],
  tier: Tier,
  now: Date,
): number {
  return listings.filter(
    (l) =>
      l.status === "active" &&
      l.permanentRank === null &&
      l.boostTier === tier &&
      hasActiveBoost(l, now),
  ).length;
}
