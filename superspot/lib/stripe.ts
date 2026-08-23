import Stripe from "stripe";

// Test-mode Stripe client. Set STRIPE_SECRET_KEY in your environment
// (sk_test_... while developing, sk_live_... in production).
// Without a key configured, checkout falls back to an instant "demo payment"
// so the whole flow is still clickable locally — see /api/checkout.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
