import { AdminSettings, Duration } from "./types";

// Default pricing. Admins can override every number below at /admin.
// Spot 1 is the most visible (top of page) and costs the most.
export const DEFAULT_SETTINGS: AdminSettings = {
  basePricesCents: {
    1: 5000, // $50 for spot #1 @ 6h
    2: 3500,
    3: 2500,
    4: 1500,
    5: 1000,
  },
  durationMultipliers: {
    6: 1,
    12: 1.8,
    24: 3.2,
    72: 7.5,
  },
  maxDurationHours: 72,
  outbidPremiumPct: 15, // must pay 15% more than remaining value to steal a spot
  bannedKeywords: [
    "porn",
    "xxx",
    "onlyfans",
    "nsfw",
    "discord.gg",
    "t.me/joinchat",
    "escort",
  ],
  bannedCategories: ["adult", "gambling-unlicensed", "weapons"],
};

// Amounts are chosen by the buyer ("pay what you want"), so they arrive from
// the client and must be validated server-side before they ever reach Stripe.
// The ceiling is Stripe's own per-charge maximum for USD.
export const MIN_AMOUNT_CENTS = 100; // $1
export const MAX_AMOUNT_CENTS = 99_999_999; // $999,999.99

/**
 * Coerce a client-supplied amount into a safe integer cent value.
 * Returns null for anything non-finite, non-numeric, or out of band —
 * callers must treat null as a rejected request, never as zero.
 */
export function normalizeAmountCents(input: unknown): number | null {
  const raw = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(raw)) return null;
  const cents = Math.round(raw);
  if (cents < MIN_AMOUNT_CENTS || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

export function priceForSpot(
  settings: AdminSettings,
  spot: number,
  durationHours: Duration
): number {
  const base = settings.basePricesCents[spot] ?? 1000;
  const mult = settings.durationMultipliers[durationHours] ?? 1;
  return Math.round(base * mult);
}

/** Remaining prorated value of an active claim, used to compute the steal ("outbid") price. */
export function remainingValueCents(
  amountCents: number,
  startedAt: number,
  expiresAt: number,
  now: number
): number {
  const total = expiresAt - startedAt;
  const remaining = Math.max(0, expiresAt - now);
  if (total <= 0) return 0;
  return Math.round(amountCents * (remaining / total));
}

export function minStealPriceCents(
  settings: AdminSettings,
  amountCents: number,
  startedAt: number,
  expiresAt: number,
  now: number
): number {
  const remaining = remainingValueCents(amountCents, startedAt, expiresAt, now);
  return Math.round(remaining * (1 + settings.outbidPremiumPct / 100));
}

export function containsBannedContent(
  settings: AdminSettings,
  text: string
): string | null {
  const lower = text.toLowerCase();
  for (const kw of settings.bannedKeywords) {
    if (lower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}
