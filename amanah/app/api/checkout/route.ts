import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  getOrCreateTool,
  grantBoost,
  grantPermanent,
  holdRank,
  rankAvailable,
  releaseHold,
} from "@/lib/db";
import { describePurchase, isRank, priceCentsFor } from "@/lib/pricing";
import { demoMode, stripeClient } from "@/lib/stripe";
import { Purchase } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  name?: unknown;
  url?: unknown;
  description?: unknown;
  purchase?: { type?: unknown; rank?: unknown; hours?: unknown };
};

function parsePurchase(raw: Body["purchase"]): Purchase | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "permanent" && typeof raw.rank === "number" && isRank(raw.rank)) {
    return { type: "permanent", rank: raw.rank };
  }
  if (raw.type === "boost" && typeof raw.hours === "number") {
    return { type: "boost", hours: raw.hours };
  }
  return null;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (name.length < 2 || name.length > 60) return bad("Tool name must be 2–60 characters.");
  if (description.length < 10 || description.length > 240) {
    return bad("Description must be 10–240 characters.");
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return bad("Link must be a valid URL.");
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return bad("Link must use http(s).");
  }

  const purchase = parsePurchase(body.purchase);
  if (!purchase) return bad("Choose a permanent rank (1–5) or a listed boost duration.");

  // The price always comes from the posted price table, never the client.
  const amountCents = priceCentsFor(purchase);
  if (amountCents === null) return bad("That duration isn't offered. Pick a listed tier.");

  if (purchase.type === "permanent" && !rankAvailable(purchase.rank)) {
    return bad(`Rank ${purchase.rank} has already been claimed.`, 409);
  }

  // --- Demo mode: settle instantly, no Stripe involved ----------------------
  if (demoMode()) {
    const tool = getOrCreateTool({ name, url, description });
    if (purchase.type === "permanent") {
      const sessionId = `demo_${nanoid(8)}`;
      if (!grantPermanent(purchase.rank, tool.id, amountCents, sessionId)) {
        return bad(`Rank ${purchase.rank} has already been claimed.`, 409);
      }
      return NextResponse.json({ demo: true, redirect: `/success?type=permanent&rank=${purchase.rank}` });
    }
    grantBoost(tool.id, purchase.hours, amountCents);
    return NextResponse.json({ demo: true, redirect: `/success?type=boost&hours=${purchase.hours}` });
  }

  // --- Real Stripe Checkout --------------------------------------------------
  const stripe = stripeClient()!;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name:
              purchase.type === "permanent"
                ? `Amanah — Permanent Rank ${purchase.rank}`
                : `Amanah — ${describePurchase(purchase)}`,
            description: `Listing: ${name}`,
          },
        },
      },
    ],
    metadata: {
      toolName: name,
      toolUrl: url,
      toolDescription: description,
      purchaseType: purchase.type,
      rank: purchase.type === "permanent" ? String(purchase.rank) : "",
      hours: purchase.type === "boost" ? String(purchase.hours) : "",
    },
    success_url: `${origin}/success?type=${purchase.type}${
      purchase.type === "permanent" ? `&rank=${purchase.rank}` : `&hours=${purchase.hours}`
    }`,
    cancel_url: `${origin}/submit?cancelled=1`,
  });

  // Reserve the rank while this buyer is on the Stripe payment page.
  if (purchase.type === "permanent") {
    if (!holdRank(purchase.rank, session.id)) {
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        // Session may already be unexpirable; the webhook's re-check is the backstop.
      }
      return bad(`Rank ${purchase.rank} has already been claimed.`, 409);
    }
  }

  if (!session.url) {
    releaseHold(session.id);
    return bad("Stripe did not return a checkout URL.", 502);
  }
  return NextResponse.json({ demo: false, redirect: session.url });
}
