export type Rank = 1 | 2 | 3 | 4 | 5;

export type Tool = {
  id: string;
  name: string;
  url: string;
  description: string;
  createdAt: number;
};

/** A permanent ranked slot, sold once at a fixed posted price. */
export type PermanentSlot = {
  rank: Rank;
  toolId: string;
  priceCents: number;
  purchasedAt: number;
};

/**
 * A short reservation placed when a Stripe Checkout session is created for a
 * permanent slot, so two buyers can't pay for the same rank at once.
 */
export type SlotHold = {
  rank: Rank;
  sessionId: string;
  expiresAt: number;
};

/** A timed boost with a fixed duration and fixed posted price. */
export type Boost = {
  id: string;
  toolId: string;
  hours: number;
  priceCents: number;
  startedAt: number;
  expiresAt: number;
};

export type Purchase =
  | { type: "permanent"; rank: Rank }
  | { type: "boost"; hours: number };

/** Shape returned by GET /api/board. */
export type BoardPayload = {
  permanent: Array<{ rank: Rank; slot: (PermanentSlot & { tool: Tool }) | null; priceCents: number; held: boolean }>;
  boosts: Array<Boost & { tool: Tool }>;
  demoMode: boolean;
  now: number;
};
