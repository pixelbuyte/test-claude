import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSettings, getFeatured, getOrCreateListing, claimSpot, bumpPermanentBoard } from "@/lib/db";
import { containsBannedContent, minStealPriceCents, priceForSpot } from "@/lib/pricing";
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
  amountCents?: number; // required for "permanent" mode (custom bid)
};

const MIN_PERMANENT_BID_CENTS = 500;

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
    if (existing?.claim) {
      const stealPrice = minStealPriceCents(
        settings,
        existing.claim.amountCents,
        existing.claim.startedAt,
        existing.claim.expiresAt,
        Date.now()
      );
      amountCents = Math.max(openPrice, stealPrice);
      description = `Steal Spot #${spot} for ${duration}h`;
    } else {
      amountCents = openPrice;
      description = `Claim Spot #${spot} for ${duration}h`;
    }
  } else {
    amountCents = Math.max(MIN_PERMANENT_BID_CENTS, Math.round(body.amountCents ?? 0));
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
