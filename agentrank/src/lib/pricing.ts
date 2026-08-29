/**
 * The URank fixed-price catalog — the single source of truth for every
 * purchasable option on the board.
 *
 * Islamic-permissible by design: every option is a fixed price for a fixed
 * rank or a fixed duration. There is no bidding, no auction, and rank among
 * timed listings is NEVER decided by who paid more (see src/lib/ranking.ts).
 *
 * The stripe.* ids below are real objects created in the connected Stripe
 * account (metadata.app = "urank"). The app looks prices up here on the
 * server — the client can never set an amount.
 */

export type Tier = "top10" | "top20" | "top50";

export type SkuKind = "permanent" | "tier_boost" | "highlight" | "featured_open";

export interface CatalogItem {
  sku: string;
  kind: SkuKind;
  label: string;
  /** Price in USD cents. */
  amountCents: number;
  /** Permanent slots only: the fixed rank being purchased (1–5). */
  rank?: number;
  /** Timed items: tier the listing is guaranteed a place in. */
  tier?: Tier;
  /** Timed items: how long the placement lasts. */
  durationHours?: number;
  /**
   * Pre-created Stripe objects for this item, when they exist. All three are
   * optional so a price point can be added here — the single source of truth —
   * without waiting on someone to provision it in the Stripe dashboard first:
   *
   * - no `priceId`  → checkout builds the line item inline from `amountCents`
   *   (see src/app/api/checkout/route.ts). The amount still comes from this
   *   catalog on the server; the client sends only a SKU, never a number.
   * - no `paymentLinkUrl` → the demo-mode manual-sales fallback has nothing to
   *   send a buyer to, so checkout refuses rather than opening a broken link.
   */
  stripe: {
    productId?: string;
    priceId?: string;
    paymentLinkUrl?: string;
  };
}

export const CATALOG: CatalogItem[] = [
  // ── Permanent Top 5 (one-time payment for a specific rank) ──────────────
  {
    sku: "permanent_rank_1",
    kind: "permanent",
    label: "Permanent Rank #1",
    amountCents: 450000,
    rank: 1,
    stripe: {
      productId: "prod_V8Ev5ezHtjZC2w",
      priceId: "price_1U7yRFRrTdDFA54jyP8qBcQN",
      paymentLinkUrl: "https://buy.stripe.com/7sY00leAl2823ui3Nb7ok05",
    },
  },
  {
    sku: "permanent_rank_2",
    kind: "permanent",
    label: "Permanent Rank #2",
    amountCents: 300000,
    rank: 2,
    stripe: {
      productId: "prod_V8F1WuMSN8kaoU",
      priceId: "price_1U7yX2RrTdDFA54j9uheipco",
      paymentLinkUrl: "https://buy.stripe.com/6oUcN7gItbIC8OCfvT7ok06",
    },
  },
  {
    sku: "permanent_rank_3",
    kind: "permanent",
    label: "Permanent Rank #3",
    amountCents: 220000,
    rank: 3,
    stripe: {
      productId: "prod_V8F1TDnWaiNmDx",
      priceId: "price_1U7yXPRrTdDFA54jEmzDS4K0",
      paymentLinkUrl: "https://buy.stripe.com/bJe00l3VHbIC5Cq4Rf7ok07",
    },
  },
  {
    sku: "permanent_rank_4",
    kind: "permanent",
    label: "Permanent Rank #4",
    amountCents: 160000,
    rank: 4,
    stripe: {
      productId: "prod_V8F1frHFzkWi8D",
      priceId: "price_1U7yX6RrTdDFA54jJTPrk8Fc",
      paymentLinkUrl: "https://buy.stripe.com/fZucN7gIt9Au4ymfvT7ok08",
    },
  },
  {
    sku: "permanent_rank_5",
    kind: "permanent",
    label: "Permanent Rank #5",
    amountCents: 120000,
    rank: 5,
    stripe: {
      productId: "prod_V8F1DxQZk38xw1",
      priceId: "price_1U7yX9RrTdDFA54jb4mTMwK2",
      paymentLinkUrl: "https://buy.stripe.com/28E6oJ9g1282fd00AZ7ok09",
    },
  },

  // ── Top 10 tier boosts ──────────────────────────────────────────────────
  // The cheapest rung on the whole board, and deliberately first: it is the
  // number the home page leads with, so the entry price a visitor sees is
  // $129 rather than a four-figure permanent rank.
  //
  // No Stripe price object exists for it yet, so checkout prices it inline
  // from amountCents. Creating a real Price (and Payment Link) in the Stripe
  // dashboard and filling the ids in below changes nothing else.
  {
    sku: "top10_3h",
    kind: "tier_boost",
    label: "Top 10 · 3 hours",
    amountCents: 12900,
    tier: "top10",
    durationHours: 3,
    stripe: {},
  },
  {
    sku: "top10_6h",
    kind: "tier_boost",
    label: "Top 10 · 6 hours",
    amountCents: 14900,
    tier: "top10",
    durationHours: 6,
    stripe: {
      productId: "prod_V8F1wdqCPI8E8P",
      priceId: "price_1U7yXSRrTdDFA54j3D52PU6B",
      paymentLinkUrl: "https://buy.stripe.com/00w9AV63PcMGe8WfvT7ok0a",
    },
  },
  {
    sku: "top10_12h",
    kind: "tier_boost",
    label: "Top 10 · 12 hours",
    amountCents: 24900,
    tier: "top10",
    durationHours: 12,
    stripe: {
      productId: "prod_V8F13K7nHS0uHQ",
      priceId: "price_1U7yXXRrTdDFA54jSRcIAwXU",
      paymentLinkUrl: "https://buy.stripe.com/eVq7sNcsd4gac0OfvT7ok0b",
    },
  },
  {
    sku: "top10_24h",
    kind: "tier_boost",
    label: "Top 10 · 24 hours",
    amountCents: 39900,
    tier: "top10",
    durationHours: 24,
    stripe: {
      productId: "prod_V8F11JlJtCADch",
      priceId: "price_1U7yXdRrTdDFA54jqw2ZkcYb",
      paymentLinkUrl: "https://buy.stripe.com/aFa5kF8bXcMG8OC1F37ok0c",
    },
  },
  {
    sku: "top10_3d",
    kind: "tier_boost",
    label: "Top 10 · 3 days",
    amountCents: 89900,
    tier: "top10",
    durationHours: 72,
    stripe: {
      productId: "prod_V8F1GowphSrc09",
      priceId: "price_1U7yXkRrTdDFA54jSgKc5sZk",
      paymentLinkUrl: "https://buy.stripe.com/28E4gB8bX3c68OCbfD7ok0d",
    },
  },
  {
    sku: "top10_7d",
    kind: "tier_boost",
    label: "Top 10 · 7 days",
    amountCents: 179900,
    tier: "top10",
    durationHours: 168,
    stripe: {
      productId: "prod_V8F1EVO6DOusnx",
      priceId: "price_1U7yXnRrTdDFA54jJUMAtNkA",
      paymentLinkUrl: "https://buy.stripe.com/6oU7sN8bXbIC3ui6Zn7ok0e",
    },
  },

  // ── Top 20 tier boosts ──────────────────────────────────────────────────
  {
    sku: "top20_6h",
    kind: "tier_boost",
    label: "Top 20 · 6 hours",
    amountCents: 8900,
    tier: "top20",
    durationHours: 6,
    stripe: {
      productId: "prod_V8F2trKadwGM5Y",
      priceId: "price_1U7yY0RrTdDFA54jhGOCDjut",
      paymentLinkUrl: "https://buy.stripe.com/cNi9AV0JvfYS8OC3Nb7ok0f",
    },
  },
  {
    sku: "top20_12h",
    kind: "tier_boost",
    label: "Top 20 · 12 hours",
    amountCents: 14900,
    tier: "top20",
    durationHours: 12,
    stripe: {
      productId: "prod_V8F2oTvWqR59EV",
      priceId: "price_1U7yY4RrTdDFA54jTQpV5HIW",
      paymentLinkUrl: "https://buy.stripe.com/bJefZj77T6oie8W5Vj7ok0g",
    },
  },
  {
    sku: "top20_24h",
    kind: "tier_boost",
    label: "Top 20 · 24 hours",
    amountCents: 24900,
    tier: "top20",
    durationHours: 24,
    stripe: {
      productId: "prod_V8F29cJoFOLhOX",
      priceId: "price_1U7yY8RrTdDFA54j3Us8W0OI",
      paymentLinkUrl: "https://buy.stripe.com/5kQ7sN1Nz282fd04Rf7ok0h",
    },
  },
  {
    sku: "top20_3d",
    kind: "tier_boost",
    label: "Top 20 · 3 days",
    amountCents: 54900,
    tier: "top20",
    durationHours: 72,
    stripe: {
      productId: "prod_V8F229Eg6b86LG",
      priceId: "price_1U7yYARrTdDFA54jN1X7bDfs",
      paymentLinkUrl: "https://buy.stripe.com/28EcN7csd6oic0O1F37ok0i",
    },
  },
  {
    sku: "top20_7d",
    kind: "tier_boost",
    label: "Top 20 · 7 days",
    amountCents: 109900,
    tier: "top20",
    durationHours: 168,
    stripe: {
      productId: "prod_V8F2B3tTGl1qhr",
      priceId: "price_1U7yYERrTdDFA54jwncgcciA",
      paymentLinkUrl: "https://buy.stripe.com/3cI14peAleUOd4ScjH7ok0j",
    },
  },

  // ── Top 50 tier boosts ──────────────────────────────────────────────────
  {
    sku: "top50_1h",
    kind: "tier_boost",
    label: "Top 50 · 1 hour",
    amountCents: 2900,
    tier: "top50",
    durationHours: 1,
    stripe: {
      productId: "prod_V8F2ZcYRpDinQj",
      priceId: "price_1U7yYRRrTdDFA54jyp6in5lq",
      paymentLinkUrl: "https://buy.stripe.com/dRmaEZcsddQK4ym4Rf7ok0k",
    },
  },
  {
    sku: "top50_6h",
    kind: "tier_boost",
    label: "Top 50 · 6 hours",
    amountCents: 6900,
    tier: "top50",
    durationHours: 6,
    stripe: {
      productId: "prod_V8F2dR4h4joYmE",
      priceId: "price_1U7yYYRrTdDFA54j6ZKBDEPH",
      paymentLinkUrl: "https://buy.stripe.com/7sY28tak5cMG6Guabz7ok0l",
    },
  },
  {
    sku: "top50_12h",
    kind: "tier_boost",
    label: "Top 50 · 12 hours",
    amountCents: 10900,
    tier: "top50",
    durationHours: 12,
    stripe: {
      productId: "prod_V8F2ERD6J5jR05",
      priceId: "price_1U7yYcRrTdDFA54jE264Ppnc",
      paymentLinkUrl: "https://buy.stripe.com/cNifZjbo9dQKe8W2J77ok0m",
    },
  },
  {
    sku: "top50_24h",
    kind: "tier_boost",
    label: "Top 50 · 24 hours",
    amountCents: 17900,
    tier: "top50",
    durationHours: 24,
    stripe: {
      productId: "prod_V8F2iOcyZl7h7a",
      priceId: "price_1U7yYgRrTdDFA54jvxkpFxGf",
      paymentLinkUrl: "https://buy.stripe.com/28EaEZ4ZL6oic0O83r7ok0n",
    },
  },
  {
    sku: "top50_3d",
    kind: "tier_boost",
    label: "Top 50 · 3 days",
    amountCents: 39900,
    tier: "top50",
    durationHours: 72,
    stripe: {
      productId: "prod_V8F2j4DpyzskrX",
      priceId: "price_1U7yYqRrTdDFA54jofwweK8f",
      paymentLinkUrl: "https://buy.stripe.com/9B69AV8bX7smgh4gzX7ok0o",
    },
  },

  // ── Highlight / Pin (visual emphasis only — never changes rank) ─────────
  {
    sku: "highlight_24h",
    kind: "highlight",
    label: "Highlight / Pin · 24 hours",
    amountCents: 14900,
    durationHours: 24,
    stripe: {
      productId: "prod_V8F3ToxiYnHeau",
      priceId: "price_1U85y7RrTdDFA54jyhpG24Ji",
      paymentLinkUrl: "https://buy.stripe.com/6oU8wR4ZLfYS4ym3Nb7ok0s",
    },
  },
  {
    sku: "highlight_3d",
    kind: "highlight",
    label: "Highlight / Pin · 3 days",
    amountCents: 34900,
    durationHours: 72,
    stripe: {
      productId: "prod_V8Mh86Z4lHIDXv",
      priceId: "price_1U85yQRrTdDFA54jOvkGzrtk",
      paymentLinkUrl: "https://buy.stripe.com/28E6oJ4ZLdQK8OC83r7ok0t",
    },
  },
  {
    sku: "highlight_7d",
    kind: "highlight",
    label: "Highlight / Pin · 7 days",
    amountCents: 59900,
    durationHours: 168,
    stripe: {
      productId: "prod_V8F3b5ljqvzB8v",
      priceId: "price_1U85y9RrTdDFA54jIsvdeqPk",
      paymentLinkUrl: "https://buy.stripe.com/9B600lbo9eUO6Guabz7ok0u",
    },
  },

  // ── Featured in the free Open Section ───────────────────────────────────
  {
    sku: "featured_open_24h",
    kind: "featured_open",
    label: "Featured in Open Section · 24 hours",
    amountCents: 4900,
    durationHours: 24,
    stripe: {
      productId: "prod_V8F3LcCISZcLkC",
      priceId: "price_1U85yHRrTdDFA54jJCZbRUo9",
      paymentLinkUrl: "https://buy.stripe.com/bJe4gBbo95keaWKabz7ok0v",
    },
  },
  {
    sku: "featured_open_7d",
    kind: "featured_open",
    label: "Featured in Open Section · 7 days",
    amountCents: 14900,
    durationHours: 168,
    stripe: {
      productId: "prod_V8Mh6uRFWKKu3j",
      priceId: "price_1U85yYRrTdDFA54j0m451Or1",
      paymentLinkUrl: "https://buy.stripe.com/9B63cx63PbIC6GubfD7ok0w",
    },
  },
];

/** How many concurrent paid placements each tier can hold. Positions 1–5 are
 * the permanent slots, 6–10 the Top 10 tier, 11–20 Top 20, 21–50 Top 50. */
export const TIER_CAPACITY: Record<Tier, number> = {
  top10: 5,
  top20: 10,
  top50: 30,
};

export const TIER_LABEL: Record<Tier, string> = {
  top10: "Top 10",
  top20: "Top 20",
  top50: "Top 50",
};

export function getCatalogItem(sku: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.sku === sku);
}

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export const PERMANENT_ITEMS = CATALOG.filter((i) => i.kind === "permanent");
export const TIER_ITEMS = (tier: Tier) =>
  CATALOG.filter((i) => i.kind === "tier_boost" && i.tier === tier);
/**
 * The cheapest way into a tier — the shortest duration on offer. Used wherever
 * a tier is advertised as a single number ("from $149") rather than as the
 * full duration ladder.
 */
/**
 * The cheapest way into a tier — the rung the board and the hero both lead
 * with. Chosen by amount rather than by position, so adding a shorter, cheaper
 * duration to CATALOG moves every "from $X" label and every one-click Rent
 * button onto it with no other edit.
 */
export function cheapestTierItem(tier: Tier): CatalogItem {
  return TIER_ITEMS(tier).reduce((low, i) =>
    i.amountCents < low.amountCents ? i : low,
  );
}

export function tierFromCents(tier: Tier): number {
  return cheapestTierItem(tier).amountCents;
}

export const HIGHLIGHT_ITEMS = CATALOG.filter((i) => i.kind === "highlight");
export const FEATURED_OPEN_ITEMS = CATALOG.filter(
  (i) => i.kind === "featured_open",
);
