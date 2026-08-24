import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { applyPurchase, completePayment, getListing } from "@/lib/db";
import { sendPurchaseConfirmation } from "@/lib/email";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook: on checkout.session.completed the purchase is verified,
 * marked complete exactly once, and applied to the listing (permanent rank,
 * tier boost, highlight, or featured badge). If availability was lost in a
 * race, the payment is flagged "conflict" for the admin to refund — a rank
 * is never double-assigned.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set." },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await req.text();
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sku = session.metadata?.sku;
  const listingId = session.metadata?.listing_id;
  if (session.metadata?.app !== "agentrank" || !sku || !listingId) {
    // Not one of ours (e.g. a manual Payment Link purchase) — acknowledge.
    return NextResponse.json({ received: true });
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  try {
    const result = await applyPurchase({ sku, listingId });

    const { alreadyProcessed } = await completePayment({
      stripeSessionId: session.id,
      status: result.ok ? "completed" : "conflict",
    });

    if (!result.ok) {
      console.error(
        `Purchase conflict for session ${session.id}: ${result.reason}`,
      );
    }

    if (result.ok && !alreadyProcessed) {
      const email = session.customer_details?.email;
      if (email) {
        const listing = await getListing(listingId);
        await sendPurchaseConfirmation({
          to: email,
          sku,
          listingName: listing?.name ?? "your listing",
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error", err);
    // Non-2xx makes Stripe retry, which is what we want for transient errors.
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
