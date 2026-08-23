import Stripe from "stripe";

// Stripe client. Set STRIPE_SECRET_KEY in the environment:
//   sk_test_... → test mode, cards are fake, nothing is charged
//   sk_live_... → LIVE mode, real cards are charged real money
// With no key set, checkout falls back to an instant "demo payment" so the
// whole flow stays clickable locally — see /api/checkout.
const key = process.env.STRIPE_SECRET_KEY;

export const stripe = key ? new Stripe(key, { apiVersion: "2024-06-20" }) : null;

/** True only when a live-mode secret key is configured — i.e. real charges. */
export const STRIPE_LIVE_MODE = !!key && key.startsWith("sk_live_");

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
