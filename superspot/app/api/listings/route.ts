import { NextRequest, NextResponse } from "next/server";
import { getFeatured, permanentLeaderboard, getRevenueCents, getSettings } from "@/lib/db";
import { priceForSpot, remainingValueCents, minStealPriceCents } from "@/lib/pricing";

// This route reads mutable, time-sensitive state (countdown timers, live
// revenue) — never let Next statically cache it.
export const dynamic = "force-dynamic";

// GET /api/listings — everything the homepage needs in one round trip.
// Used for the initial render and for the realtime-ish polling refresh.
export async function GET(_req: NextRequest) {
  const settings = getSettings();
  const now = Date.now();

  const featured = getFeatured().map(({ spot, claim, listing }) => {
    const nextDurationForPrice = 6 as const;
    const openPrice = priceForSpot(settings, spot, nextDurationForPrice);
    if (!claim || !listing) {
      return { spot, claim: null, listing: null, openPriceCents: openPrice, stealPriceCents: null };
    }
    const stealPrice = minStealPriceCents(
      settings,
      claim.amountCents,
      claim.startedAt,
      claim.expiresAt,
      now
    );
    return {
      spot,
      claim,
      listing,
      openPriceCents: openPrice,
      stealPriceCents: stealPrice,
      remainingValueCents: remainingValueCents(claim.amountCents, claim.startedAt, claim.expiresAt, now),
    };
  });

  return NextResponse.json({
    now,
    featured,
    leaderboard: permanentLeaderboard(),
    revenueCents: getRevenueCents(),
    settings,
  });
}
