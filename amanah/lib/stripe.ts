import Stripe from "stripe";

// With no STRIPE_SECRET_KEY set, the app runs in demo mode: checkout settles
// instantly server-side and nothing is ever charged. Set a test key
// (sk_test_...) to exercise real Stripe Checkout without real money.

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

export function demoMode(): boolean {
  return !process.env.STRIPE_SECRET_KEY;
}

export function liveMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
}
