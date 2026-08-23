export type Duration = 6 | 12 | 24 | 72; // hours

export type Listing = {
  id: string;
  url: string;
  handle: string | null;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  clicks: number;
  totalPaid: number; // lifetime cents paid, used to rank the permanent board
  createdAt: number;
};

export type FeaturedClaim = {
  id: string;
  listingId: string;
  spot: number; // 1..5
  amountCents: number;
  durationHours: Duration;
  startedAt: number;
  expiresAt: number;
};

export type AdminSettings = {
  basePricesCents: Record<number, number>; // per spot, for the shortest duration
  durationMultipliers: Record<Duration, number>;
  maxDurationHours: Duration;
  outbidPremiumPct: number; // % over remaining value required to steal a spot
  bannedKeywords: string[];
  bannedCategories: string[];
};
