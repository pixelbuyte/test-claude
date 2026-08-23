import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { claimSpot, bumpPermanentBoard, claimEventOnce } from "@/lib/db";
import { Duration } from "@/lib/types";

// Signature verification needs the raw body, so this route must never be
// statically optimised or have its body parsed ahead of us.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Stripe webhook — completes the purchase once payment actually succeeds.
// Point a Stripe webhook endpoint at https://<your-domain>/api/webhook and
// subscribe it to `checkout.session.completed`.
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    // Without the signing secret we cannot tell a real Stripe call from a
    // forged one, and this endpoint grants free board placement. Refuse.
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not set" },
      { status: 500 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      metadata?: Record<string, string>;
      amount_total?: number | null;
      payment_status?: string;
    };

    // Only credit once the money is actually captured — a completed session
    // can still be `unpaid` for async payment methods.
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, skipped: "unpaid" });
    }

    // Stripe retries until it gets a 2xx. Without this guard, a retry would
    // credit the same payment a second time.
    if (!claimEventOnce(event.id)) {
      return NextResponse.json({ received: true, deduped: true });
    }

    const meta = session.metadata ?? {};
    const listingId = meta.listingId;

    // Trust what Stripe actually collected over what we asked for, so the
    // credited amount can never drift from the charged amount.
    const amountCents = session.amount_total ?? Number(meta.amountCents ?? 0);

    if (listingId && Number.isFinite(amountCents) && amountCents > 0) {
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
