import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { claimSpot, bumpPermanentBoard } from "@/lib/db";
import { Duration } from "@/lib/types";

// Stripe webhook — completes the purchase once payment actually succeeds.
// Configure this endpoint (https://yourdomain.com/api/webhook) in the Stripe
// dashboard, listening for `checkout.session.completed`.
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  }

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature verification failed` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { metadata?: Record<string, string> };
    const meta = session.metadata ?? {};
    const amountCents = Number(meta.amountCents ?? 0);
    const listingId = meta.listingId;

    if (listingId && amountCents > 0) {
      if (meta.mode === "featured" && meta.spot && meta.durationHours) {
        claimSpot({
          listingId,
          spot: Number(meta.spot),
          durationHours: Number(meta.durationHours) as Duration,
          amountCents,
        });
      } else {
        bumpPermanentBoard(listingId, amountCents);
      }
    }
  }

  return NextResponse.json({ received: true });
}
