import { NextRequest, NextResponse } from "next/server";

import {
  createListing,
  demoMode,
  DemoModeError,
  getActiveListings,
  getListing,
  isPermanentRankTaken,
  recordPendingPayment,
} from "@/lib/db";
import { getCatalogItem, TIER_CAPACITY, TIER_LABEL, type Tier } from "@/lib/pricing";
import { countActiveBoosts } from "@/lib/ranking";
import { isStripeConfigured, siteUrl, stripe } from "@/lib/stripe";
import { CATEGORIES, type SubmitListingInput } from "@/lib/types";
import { isEmail, normalizeUrl } from "@/lib/utils";

export const runtime = "nodejs";

interface CheckoutBody {
  sku?: string;
  listingId?: string;
  newListing?: {
    name?: string;
    url?: string;
    description?: string;
    category?: string;
    ownerEmail?: string;
  };
}

function parseNewListing(
  raw: NonNullable<CheckoutBody["newListing"]>,
): SubmitListingInput | { error: string } {
  const name = (raw.name ?? "").trim();
  const url = normalizeUrl(raw.url ?? "");
  const description = (raw.description ?? "").trim();
  const category = CATEGORIES.find((c) => c.slug === raw.category)?.slug ?? "other";
  if (name.length < 2 || name.length > 60) {
    return { error: "Name must be 2–60 characters." };
  }
  if (!url) return { error: "Enter a valid link (website or social profile)." };
  if (description.length > 120) {
    return { error: "Description must be 120 characters or fewer." };
  }
  const ownerEmail = raw.ownerEmail?.trim();
  return {
    name,
    url,
    description,
    category,
    ownerEmail: ownerEmail && isEmail(ownerEmail) ? ownerEmail : undefined,
  };
}

/**
 * Creates a Stripe Checkout Session for one fixed-price catalog item.
 * Prices come exclusively from the server-side catalog — the client sends a
 * SKU, never an amount. Availability is checked here and re-checked by the
 * webhook before the purchase is applied.
 */
export async function POST(req: NextRequest) {
  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const item = getCatalogItem(body.sku ?? "");
  if (!item) {
    return NextResponse.json({ error: "Unknown package." }, { status: 400 });
  }

  // Fully unconfigured (demo mode, no Stripe): fall back to the matching
  // Stripe Payment Link — a manual sales channel where the buyer identifies
  // their listing and the owner applies the placement by hand.
  if (!isStripeConfigured() && demoMode()) {
    return NextResponse.json({ url: item.stripe.paymentLinkUrl, fallback: true });
  }
  // Half-configured deployments must never take money they can't fulfill.
  if (!isStripeConfigured() || demoMode()) {
    return NextResponse.json(
      {
        error:
          "Payments are not fully configured on this deployment (Stripe and Supabase are both required).",
      },
      { status: 503 },
    );
  }

  try {
    const listings = await getActiveListings();
    const now = new Date();

    if (item.kind === "permanent") {
      // Any-status check: a rank held by a pending/rejected listing is still
      // owned in the DB and would only produce a conflict at webhook time.
      if (await isPermanentRankTaken(item.rank!)) {
        return NextResponse.json(
          { error: `Permanent Rank #${item.rank} is already owned.` },
          { status: 409 },
        );
      }
    }
    if (item.kind === "tier_boost") {
      const tier = item.tier!;
      const excludeSelf = body.listingId
        ? listings.filter((l) => l.id !== body.listingId)
        : listings;
      if (countActiveBoosts(excludeSelf, tier, now) >= TIER_CAPACITY[tier]) {
        return NextResponse.json(
          {
            error: `The ${TIER_LABEL[tier]} tier is currently full. Slots free up automatically as boosts expire.`,
          },
          { status: 409 },
        );
      }
    }

    // Attach the purchase to an existing listing, or create one now so the
    // buyer never ends up with a duplicate.
    let listingId = body.listingId ?? null;
    if (listingId) {
      const existing = await getListing(listingId);
      if (!existing) {
        return NextResponse.json({ error: "Listing not found." }, { status: 404 });
      }
      if (existing.status === "rejected") {
        return NextResponse.json(
          { error: "This listing was rejected and cannot buy placements." },
          { status: 409 },
        );
      }
      if (item.kind === "tier_boost") {
        if (existing.permanentRank !== null) {
          return NextResponse.json(
            {
              error:
                "This listing already holds a permanent rank — a tier boost would have no effect.",
            },
            { status: 409 },
          );
        }
        const priority: Record<Tier, number> = { top10: 3, top20: 2, top50: 1 };
        const activeBoost =
          existing.boostTier !== null &&
          existing.boostExpiresAt !== null &&
          new Date(existing.boostExpiresAt) > now;
        if (activeBoost && priority[item.tier!] < priority[existing.boostTier!]) {
          return NextResponse.json(
            {
              error: `This listing already holds an active ${TIER_LABEL[existing.boostTier!]} placement — buying a lower tier would downgrade it.`,
            },
            { status: 409 },
          );
        }
      }
    } else {
      if (!body.newListing) {
        return NextResponse.json(
          { error: "Choose an existing listing or provide listing details." },
          { status: 400 },
        );
      }
      const parsed = parseNewListing(body.newListing);
      if ("error" in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const created = await createListing(parsed);
      listingId = created.id;
    }

    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: item.stripe.priceId, quantity: 1 }],
      metadata: { app: "agentrank", sku: item.sku, listing_id: listingId },
      success_url: `${siteUrl()}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/pricing`,
    });

    await recordPendingPayment({
      stripeSessionId: session.id,
      sku: item.sku,
      amountCents: item.amountCents,
      listingId,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof DemoModeError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Checkout error", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 },
    );
  }
}
