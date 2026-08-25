import { NextRequest, NextResponse } from "next/server";

import {
  createListing,
  demoMode,
  DemoModeError,
  findListingByUrl,
  getActiveListings,
  isPermanentRankTaken,
  recordPendingPayment,
} from "@/lib/db";
import { getCatalogItem, TIER_CAPACITY, TIER_LABEL, type Tier } from "@/lib/pricing";
import { countActiveBoosts } from "@/lib/ranking";
import { fetchSiteMetadata, guessCategory } from "@/lib/site-metadata";
import { isStripeConfigured, siteUrl, stripe } from "@/lib/stripe";
import { normalizeUrl, urlMatchKey } from "@/lib/utils";

/**
 * Stripe only accepts [A-Za-z0-9_-], max 200 chars, for a client_reference_id
 * passed through a Payment Link URL — so a raw link cannot go in as-is. This
 * keeps it human-readable in the dashboard: "skinstel.com" -> "skinstel-com".
 * Returns null when there is nothing usable, so the link is sent unadorned
 * rather than with a meaningless reference attached.
 */
function clientReferenceId(rawUrl: string): string | null {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return null;
  const ref = urlMatchKey(normalized)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
  return ref || null;
}

export const runtime = "nodejs";

interface CheckoutBody {
  sku?: string;
  url?: string;
}

const TIER_PRIORITY: Record<Tier, number> = { top10: 3, top20: 2, top50: 1 };

/**
 * Creates a Stripe Checkout Session for one fixed-price catalog item.
 * Prices come exclusively from the server-side catalog — the client sends a
 * SKU, never an amount. The buyer only ever supplies a URL: if it's already
 * listed the placement upgrades that listing in place, otherwise a new
 * listing is created automatically with its name/description/logo scraped
 * from the site. Availability is re-checked by the webhook before the
 * purchase is applied.
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
  // Stripe Payment Link — a manual sales channel where the owner applies the
  // placement by hand.
  //
  // The buyer's link rides along as client_reference_id so it lands on the
  // Stripe session and shows up in the dashboard next to the payment. That is
  // what lets this stay a single click: previously the app stopped to ask the
  // buyer to retype their URL into the Stripe notes field, because the generic
  // Payment Link carried no listing and the URL would otherwise be lost.
  if (!isStripeConfigured() && demoMode()) {
    const link = new URL(item.stripe.paymentLinkUrl);
    const ref = clientReferenceId(body.url ?? "");
    if (ref) link.searchParams.set("client_reference_id", ref);
    return NextResponse.json({ url: link.toString() });
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

  const url = normalizeUrl(body.url ?? "");
  if (!url) {
    return NextResponse.json(
      { error: "Enter a valid site URL — e.g. acme.ai or x.com/acme." },
      { status: 400 },
    );
  }

  try {
    const existing = await findListingByUrl(url);

    if (existing?.status === "rejected") {
      return NextResponse.json(
        {
          error:
            "This site was previously removed from the board and can't buy placements. Contact support.",
        },
        { status: 409 },
      );
    }

    if (item.kind === "permanent") {
      // Buying the rank you already hold is a harmless no-op — only block
      // when someone ELSE holds it (any status, since a rank held by a
      // pending/rejected row is still unavailable in the DB).
      const alreadyMine = existing?.permanentRank === item.rank;
      if (!alreadyMine && (await isPermanentRankTaken(item.rank!))) {
        return NextResponse.json(
          { error: `Permanent Rank #${item.rank} is already owned.` },
          { status: 409 },
        );
      }
    }

    if (item.kind === "tier_boost" && existing) {
      if (existing.permanentRank !== null) {
        return NextResponse.json(
          {
            error:
              "This site already holds a permanent rank — a tier boost would have no effect.",
          },
          { status: 409 },
        );
      }
      const now = new Date();
      const activeBoost =
        existing.boostTier !== null &&
        existing.boostExpiresAt !== null &&
        new Date(existing.boostExpiresAt) > now;
      if (activeBoost && TIER_PRIORITY[item.tier!] < TIER_PRIORITY[existing.boostTier!]) {
        return NextResponse.json(
          {
            error: `This site already holds an active ${TIER_LABEL[existing.boostTier!]} placement — buying a lower tier would downgrade it.`,
          },
          { status: 409 },
        );
      }
    }

    if (item.kind === "tier_boost") {
      const tier = item.tier!;
      const listings = await getActiveListings();
      const excludeSelf = existing
        ? listings.filter((l) => l.id !== existing.id)
        : listings;
      if (countActiveBoosts(excludeSelf, tier, new Date()) >= TIER_CAPACITY[tier]) {
        return NextResponse.json(
          {
            error: `The ${TIER_LABEL[tier]} tier is currently full. Slots free up automatically as boosts expire.`,
          },
          { status: 409 },
        );
      }
    }

    // Attach the purchase to the listing already at this URL, or create one
    // automatically — the buyer never has to fill out a form or risk a
    // duplicate.
    let listingId: string;
    if (existing) {
      listingId = existing.id;
    } else {
      const meta = await fetchSiteMetadata(url);
      const created = await createListing({
        name: meta.name,
        url,
        description: meta.description,
        logoUrl: meta.logoUrl ?? undefined,
        category: guessCategory(meta.name, meta.description),
      });
      listingId = created.id;
    }

    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: item.stripe.priceId, quantity: 1 }],
      metadata: { app: "urank", sku: item.sku, listing_id: listingId },
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
