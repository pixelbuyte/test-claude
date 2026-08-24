import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  applyPurchase,
  claimPayment,
  getListing,
  markPayment,
  releasePaymentClaim,
} from "@/lib/db";
import { sendPurchaseConfirmation } from "@/lib/email";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook. Flow, in order, per paid session:
 *
 *   1. Claim the payment row (pending → completed) — the atomic idempotency
 *      gate. Duplicate deliveries find nothing to claim and stop here, so a
 *      retried event can never extend a boost or highlight twice.
 *   2. Apply the purchase. A genuine availability loss (rank won by someone
 *      else, tier full, rejected listing) downgrades the payment to
 *      "conflict" for the admin to refund — never double-sold. A transient
 *      failure releases the claim and returns 500 so Stripe retries.
 *
 * checkout.session.completed with payment_status "unpaid" (delayed payment
 * methods) is acked and left pending; async_payment_succeeded fulfills it
 * later and async_payment_failed marks it "failed".
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

  const relevant =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed";
  if (!relevant) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sku = session.metadata?.sku;
  const listingId = session.metadata?.listing_id;
  if (session.metadata?.app !== "uprank" || !sku || !listingId) {
    // Not one of ours (e.g. a manual Payment Link purchase) — acknowledge.
    return NextResponse.json({ received: true });
  }

  try {
    if (event.type === "checkout.session.async_payment_failed") {
      await markPayment(session.id, "failed");
      return NextResponse.json({ received: true });
    }

    if (session.payment_status !== "paid") {
      // Delayed payment method: async_payment_succeeded will fulfill later.
      return NextResponse.json({ received: true });
    }

    const { alreadyProcessed } = await claimPayment(session.id);
    if (alreadyProcessed) {
      return NextResponse.json({ received: true });
    }

    let result;
    try {
      result = await applyPurchase({ sku, listingId });
    } catch (err) {
      // Transient failure: hand the claim back so Stripe's retry re-runs it.
      await releasePaymentClaim(session.id);
      throw err;
    }

    if (!result.ok) {
      console.error(
        `Purchase conflict for session ${session.id}: ${result.reason} — refund this payment.`,
      );
      await markPayment(session.id, "conflict");
      return NextResponse.json({ received: true });
    }

    const email = session.customer_details?.email;
    if (email) {
      const listing = await getListing(listingId);
      await sendPurchaseConfirmation({
        to: email,
        sku,
        listingName: listing?.name ?? "your listing",
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error", err);
    // Non-2xx makes Stripe retry, which is what we want for transient errors.
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
