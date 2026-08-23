import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSettings, getFeatured, getOrCreateListing, claimSpot, bumpPermanentBoard } from "@/lib/db";
import {
  containsBannedContent,
  minStealPriceCents,
  priceForSpot,
  normalizeAmountCents,
  MIN_AMOUNT_CENTS,
  MAX_AMOUNT_CENTS,
} from "@/lib/pricing";
import { Duration } from "@/lib/types";

type Body = {
  mode: "featured" | "permanent";
  url: string;
  handle?: string | null;
  title: string;
  description?: string;
  image?: string | null;
  favicon?: string | null;
  spot?: number;
  durationHours?: Duration;
  /** Buyer-chosen amount. Required for "permanent"; optional for "featured",
   *  where it may exceed the asking price but never undercut it. */
  amountCents?: number;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const settings = getSettings();

  const bannedHit =
    containsBannedContent(settings, body.url) ||
    containsBannedContent(settings, body.title) ||
    containsBannedContent(settings, body.description ?? "");
  if (bannedHit) {
    return NextResponse.json(
      { error: `Listing blocked by content filter (matched "${bannedHit}"). No NSFW, invite links, or adult content.` },
      { status: 400 }
    );
  }

  let target: URL;
  try {
    target = new URL(body.url);
    if (!/^https?:$/.test(target.protocol)) throw new Error("bad protocol");
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  let amountCents: number;
  let description = `Claim a SuperSpot for ${target.hostname}`;

  if (body.mode === "featured") {
    const spot = body.spot;
    const duration = body.durationHours;
    if (!spot || spot < 1 || spot > 5) {
      return NextResponse.json({ error: "Invalid spot" }, { status: 400 });
    }
    if (!duration || duration > settings.maxDurationHours) {
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }
    const openPrice = priceForSpot(settings, spot, duration);
    const existing = getFeatured().find((f) => f.spot === spot);

    let floor: number;
    if (existing?.claim) {
      const stealPrice = minStealPriceCents(
        settings,
        existing.claim.amountCents,
        existing.claim.startedAt,
        existing.claim.expiresAt,
        Date.now()
      );
      floor = Math.max(openPrice, stealPrice);
      description = `Steal Spot #${spot} for ${duration}h`;
    } else {
      floor = openPrice;
      description = `Claim Spot #${spot} for ${duration}h`;
    }

    // Paying over the asking price is allowed and meaningful: the steal price
    // is prorated from what the holder paid, so overpaying makes the spot
    // costlier to take. Undercutting the floor is not.
    if (body.amountCents === undefined || body.amountCents === null) {
      amountCents = floor;
    } else {
      const chosen = normalizeAmountCents(body.amountCents);
      if (chosen === null) {
        return NextResponse.json(
          { error: `Enter an amount between ${money(MIN_AMOUNT_CENTS)} and ${money(MAX_AMOUNT_CENTS)}.` },
          { status: 400 }
        );
      }
      if (chosen < floor) {
        return NextResponse.json(
          { error: `This spot costs at least ${money(floor)} right now.` },
          { status: 400 }
        );
      }
      amountCents = chosen;
    }
  } else {
    // Permanent board is pure pay-what-you-want — any amount ranks you.
    const chosen = normalizeAmountCents(body.amountCents);
    if (chosen === null) {
      return NextResponse.json(
        { error: `Enter an amount between ${money(MIN_AMOUNT_CENTS)} and ${money(MAX_AMOUNT_CENTS)}.` },
        { status: 400 }
      );
    }
    amountCents = chosen;
    description = `Bid on the SuperSpot leaderboard for ${target.hostname}`;
  }

  const listing = getOrCreateListing({
    url: body.url,
    handle: body.handle ?? null,
    title: body.title,
    description: body.description ?? "",
    image: body.image ?? null,
    favicon: body.favicon ?? null,
  });

  const metadata = {
    mode: body.mode,
    listingId: listing.id,
    spot: String(body.spot ?? ""),
    durationHours: String(body.durationHours ?? ""),
    amountCents: String(amountCents),
  };

  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: description,
              images: listing.image ? [listing.image] : undefined,
            },
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${req.nextUrl.origin}/?paid=1`,
      cancel_url: `${req.nextUrl.origin}/?canceled=1`,
    });
    return NextResponse.json({ checkoutUrl: session.url });
  }

  // Demo mode: no Stripe key configured, so we settle the "payment" instantly
  // and unblock the flow end-to-end for local development / preview.
  if (body.mode === "featured" && body.spot && body.durationHours) {
    const claim = claimSpot({
      listingId: listing.id,
      spot: body.spot,
      durationHours: body.durationHours,
      amountCents,
    });
    return NextResponse.json({ demo: true, listing, claim });
  } else {
    bumpPermanentBoard(listing.id, amountCents);
    return NextResponse.json({ demo: true, listing });
  }
}
