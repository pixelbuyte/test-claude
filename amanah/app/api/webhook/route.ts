import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  alreadyProcessed,
  getOrCreateTool,
  grantBoost,
  grantPermanent,
  markProcessed,
  recordRefundNeeded,
} from "@/lib/db";
import { boostTier, isRank } from "@/lib/pricing";
import { stripeClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// This endpoint is what grants placement on the board, so an unsigned
// request must never be trusted: it refuses to run without a webhook secret.
export async function POST(req: NextRequest) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // Stripe retries deliveries until it gets a 2xx; de-duplicate on event id.
  if (alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const m = session.metadata ?? {};
    const name = m.toolName ?? "";
    const url = m.toolUrl ?? "";
    const description = m.toolDescription ?? "";

    if (name && url) {
      const tool = getOrCreateTool({ name, url, description });

      if (m.purchaseType === "permanent") {
        const rank = Number(m.rank);
        if (isRank(rank)) {
          const granted = grantPermanent(
            rank,
            tool.id,
            session.amount_total ?? 0,
            session.id
          );
          if (!granted) {
            // The hold expired and someone else completed payment first.
            // Nothing is granted; refund this payment from the Stripe
            // dashboard (fixed-price sales must deliver or be returned).
            recordRefundNeeded(session.id, rank, name);
            console.error(
              `[amanah] Rank ${rank} sold twice — refund session ${session.id} (${name}).`
            );
          }
        }
      } else if (m.purchaseType === "boost") {
        const tier = boostTier(Number(m.hours));
        if (tier) grantBoost(tool.id, tier.hours, session.amount_total ?? tier.cents);
      }
    }
  }

  markProcessed(event.id);
  return NextResponse.json({ received: true });
}
