import { Purchase, Rank } from "./types";

// Every price on Amanah is fixed and posted publicly. There is no bidding,
// no outbidding, no dynamic pricing — the same price for every buyer. These
// tables are the single source of truth: the server derives the amount from
// them and never trusts a price sent by the browser.

export const RANKS: Rank[] = [1, 2, 3, 4, 5];

export const PERMANENT_PRICES_CENTS: Record<Rank, number> = {
  1: 450000, // $4,500
  2: 300000, // $3,000
  3: 220000, // $2,200
  4: 160000, // $1,600
  5: 120000, // $1,200
};

export type BoostTier = { hours: number; cents: number; label: string };

export const BOOST_TIERS: BoostTier[] = [
  { hours: 6, cents: 14900, label: "6 hours" },
  { hours: 12, cents: 24900, label: "12 hours" },
  { hours: 24, cents: 39900, label: "24 hours" },
  { hours: 72, cents: 89900, label: "3 days" },
  { hours: 168, cents: 179900, label: "7 days" },
];

/** How long a permanent slot stays reserved while its checkout is pending. */
export const HOLD_MINUTES = 30;

export function boostTier(hours: number): BoostTier | undefined {
  return BOOST_TIERS.find((t) => t.hours === hours);
}

export function isRank(n: number): n is Rank {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

/** Resolve the fixed price of a purchase, or null if it names no real product. */
export function priceCentsFor(purchase: Purchase): number | null {
  if (purchase.type === "permanent") {
    return isRank(purchase.rank) ? PERMANENT_PRICES_CENTS[purchase.rank] : null;
  }
  return boostTier(purchase.hours)?.cents ?? null;
}

export function describePurchase(purchase: Purchase): string {
  if (purchase.type === "permanent") {
    return `Permanent Rank ${purchase.rank} — one-time, fixed price`;
  }
  const tier = boostTier(purchase.hours);
  return `Timed boost — ${tier?.label ?? `${purchase.hours} hours`}, fixed price`;
}

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}
