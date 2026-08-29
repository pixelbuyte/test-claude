import { nanoid } from "nanoid";
import { Boost, PermanentSlot, Rank, SlotHold, Tool } from "./types";
import { BOOST_TIERS, HOLD_MINUTES, PERMANENT_PRICES_CENTS, RANKS } from "./pricing";

// ---------------------------------------------------------------------------
// Demo data store: a single in-memory object, kept alive across hot reloads
// via globalThis (the same trick superspot/lib/db.ts uses). State resets on
// deploy/restart — schema.sql at the project root holds the equivalent
// Postgres schema, and these function signatures are the swap-in surface.
// ---------------------------------------------------------------------------

type Store = {
  tools: Map<string, Tool>;
  permanent: Map<Rank, PermanentSlot>;
  holds: Map<Rank, SlotHold>;
  boosts: Map<string, Boost>;
  /** Stripe event ids already applied, so webhook retries don't double-grant. */
  processedEvents: Set<string>;
  /**
   * Payments that completed for a permanent slot that had meanwhile been
   * sold to someone else (hold expired, another buyer finished first).
   * Nothing is granted; these must be refunded in the Stripe dashboard.
   */
  refundsNeeded: Array<{ sessionId: string; rank: Rank; toolName: string; at: number }>;
};

const g = globalThis as unknown as { __amanahStore?: Store };

function makeTool(partial: Partial<Tool> & { name: string; url: string }): Tool {
  return {
    id: partial.id ?? nanoid(10),
    name: partial.name,
    url: partial.url,
    description: partial.description ?? "",
    createdAt: partial.createdAt ?? Date.now(),
  };
}

function seed(): Store {
  const tools = new Map<string, Tool>();
  const permanent = new Map<Rank, PermanentSlot>();
  const boosts = new Map<string, Boost>();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // Three of the five permanent slots start sold, so the board shows the
  // hierarchy immediately — and two stay open so the "claim a permanent
  // rank" flow is demonstrable without any setup.
  const seedPermanent: Array<[Rank, string, string, string, number]> = [
    [1, "Clockwork", "https://example.com/clockwork", "Autonomous browser agents that file your paperwork, book logistics, and reconcile invoices end-to-end.", 21],
    [2, "Relay Loop", "https://example.com/relayloop", "No-code automation canvas connecting 400+ SaaS apps with human-in-the-loop approval steps.", 14],
    [4, "Qalam AI", "https://example.com/qalam", "Drafting agent for contracts and RFPs that cites every clause back to your playbook.", 8],
  ];
  for (const [rank, name, url, description, daysAgo] of seedPermanent) {
    const tool = makeTool({ name, url, description, createdAt: now - daysAgo * day });
    tools.set(tool.id, tool);
    permanent.set(rank, {
      rank,
      toolId: tool.id,
      priceCents: PERMANENT_PRICES_CENTS[rank],
      purchasedAt: now - daysAgo * day,
    });
  }

  // A handful of live boosts at different tiers, each partly elapsed, so the
  // feed shows real countdowns and the remaining-time sort from first load.
  const seedBoosts: Array<[string, string, string, number, number]> = [
    // name, url, description, tier hours, fraction already elapsed
    ["Sahl Desk", "https://example.com/sahl", "Support agent that resolves tier-1 tickets in 40+ languages and escalates with full context.", 168, 0.3],
    ["PipeWright", "https://example.com/pipewright", "Data-pipeline copilot: describe the transformation, get tested dbt models.", 72, 0.45],
    ["Meridian Ops", "https://example.com/meridian", "Incident-response automation that drafts the postmortem while you fix the outage.", 24, 0.4],
    ["Falak Analytics", "https://example.com/falak", "Agents that watch your dashboards and brief you only when a metric actually moves.", 12, 0.25],
  ];
  for (const [name, url, description, hours, elapsed] of seedBoosts) {
    const tier = BOOST_TIERS.find((t) => t.hours === hours)!;
    const tool = makeTool({ name, url, description });
    tools.set(tool.id, tool);
    const startedAt = now - Math.round(hours * 60 * 60 * 1000 * elapsed);
    const boost: Boost = {
      id: nanoid(10),
      toolId: tool.id,
      hours,
      priceCents: tier.cents,
      startedAt,
      expiresAt: startedAt + hours * 60 * 60 * 1000,
    };
    boosts.set(boost.id, boost);
  }

  return {
    tools,
    permanent,
    holds: new Map(),
    boosts,
    processedEvents: new Set(),
    refundsNeeded: [],
  };
}

function store(): Store {
  if (!g.__amanahStore) g.__amanahStore = seed();
  sweep(g.__amanahStore);
  return g.__amanahStore;
}

function sweep(s: Store) {
  const now = Date.now();
  for (const [id, boost] of s.boosts) {
    if (boost.expiresAt <= now) s.boosts.delete(id);
  }
  for (const [rank, hold] of s.holds) {
    if (hold.expiresAt <= now) s.holds.delete(rank);
  }
}

// --- Tools -------------------------------------------------------------------

export function getOrCreateTool(input: { name: string; url: string; description: string }): Tool {
  const s = store();
  const existing = [...s.tools.values()].find((t) => t.url === input.url);
  if (existing) {
    existing.name = input.name;
    existing.description = input.description;
    return existing;
  }
  const tool = makeTool(input);
  s.tools.set(tool.id, tool);
  return tool;
}

export function getTool(id: string): Tool | undefined {
  return store().tools.get(id);
}

// --- Permanent slots ---------------------------------------------------------

export function permanentSlots(): Map<Rank, PermanentSlot> {
  return store().permanent;
}

export function rankAvailable(rank: Rank, forSessionId?: string): boolean {
  const s = store();
  if (s.permanent.has(rank)) return false;
  const hold = s.holds.get(rank);
  if (hold && hold.sessionId !== forSessionId) return false;
  return true;
}

export function holdRank(rank: Rank, sessionId: string): boolean {
  const s = store();
  if (!rankAvailable(rank, sessionId)) return false;
  s.holds.set(rank, {
    rank,
    sessionId,
    expiresAt: Date.now() + HOLD_MINUTES * 60 * 1000,
  });
  return true;
}

export function releaseHold(sessionId: string) {
  const s = store();
  for (const [rank, hold] of s.holds) {
    if (hold.sessionId === sessionId) s.holds.delete(rank);
  }
}

/** Grant a paid permanent slot. Returns false if the rank is no longer free. */
export function grantPermanent(
  rank: Rank,
  toolId: string,
  priceCents: number,
  sessionId: string
): boolean {
  const s = store();
  if (!rankAvailable(rank, sessionId)) return false;
  s.holds.delete(rank);
  s.permanent.set(rank, { rank, toolId, priceCents, purchasedAt: Date.now() });
  return true;
}

export function recordRefundNeeded(sessionId: string, rank: Rank, toolName: string) {
  store().refundsNeeded.push({ sessionId, rank, toolName, at: Date.now() });
}

// --- Boosts ------------------------------------------------------------------

export function grantBoost(toolId: string, hours: number, priceCents: number): Boost {
  const s = store();
  const now = Date.now();
  const boost: Boost = {
    id: nanoid(10),
    toolId,
    hours,
    priceCents,
    startedAt: now,
    expiresAt: now + hours * 60 * 60 * 1000,
  };
  s.boosts.set(boost.id, boost);
  return boost;
}

/** Active boosts, most remaining time first — the feed's display order. */
export function activeBoosts(): Boost[] {
  return [...store().boosts.values()].sort((a, b) => b.expiresAt - a.expiresAt);
}

// --- Webhook idempotency -----------------------------------------------------

export function alreadyProcessed(eventId: string): boolean {
  return store().processedEvents.has(eventId);
}

export function markProcessed(eventId: string) {
  store().processedEvents.add(eventId);
}

// --- Board -------------------------------------------------------------------

export function boardState() {
  const s = store();
  return {
    permanent: RANKS.map((rank) => {
      const slot = s.permanent.get(rank) ?? null;
      return {
        rank,
        slot: slot ? { ...slot, tool: s.tools.get(slot.toolId)! } : null,
        priceCents: PERMANENT_PRICES_CENTS[rank],
        held: !slot && s.holds.has(rank),
      };
    }),
    boosts: activeBoosts().map((b) => ({ ...b, tool: s.tools.get(b.toolId)! })),
    now: Date.now(),
  };
}
