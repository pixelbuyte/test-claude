import { NextRequest, NextResponse } from "next/server";
import { getFeatured, permanentLeaderboard, getRevenueCents, getSettings } from "@/lib/db";
import { priceForSpot, remainingValueCents, minStealPriceCents, MIN_AMOUNT_CENTS } from "@/lib/pricing";
import { stripe, STRIPE_LIVE_MODE } from "@/lib/stripe";

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
      now,
      spot
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
    // Lets the UI state the truth about charges instead of hardcoding
    // "test mode" regardless of how the deployment is actually configured.
    payments: {
      enabled: !!stripe,
      live: STRIPE_LIVE_MODE,
      minAmountCents: MIN_AMOUNT_CENTS,
    },
  });
}
