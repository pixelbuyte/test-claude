/**
 * Demo board data used when Supabase env vars are absent, so a fresh clone
 * renders a fully populated, working board. The UI shows a "Demo data" badge
 * whenever this module is serving.
 *
 * These use real, reachable URLs so every row renders a real favicon — the
 * board's logo slot derives its icon from the listing URL, so placeholder
 * domains would leave every row showing initials.
 *
 * Permanent ranks #1, #2 and #5 are deliberately left UNSOLD so the board and
 * the hero both show a genuine "claim this spot" call to action.
 */

import type { Listing } from "@/lib/types";
import { faviconUrl } from "@/lib/utils";

const h = 3600_000;

function iso(offsetMs: number, now: number): string {
  return new Date(now + offsetMs).toISOString();
}

export { h, iso };

/**
 * Seed rows: real sites, with click counts in a believable early-days band
 * (a couple of hundred each) rather than implausible five-figure numbers.
 *
 * These counts are fixed. Demo mode has no database, so there is nowhere to
 * record a click, and inventing movement here would contradict the promise on
 * /rules that click counts are real outbound clicks. Once Supabase is
 * configured, `increment_click` takes over and every listing counts up from
 * whatever it is already sitting at.
 */
export interface Seed {
  id: string;
  name: string;
  url: string;
  description: string;
  category: Listing["category"];
  clickCount: number;
  ageDays: number;
  permanentRank?: number;
  boostTier?: Listing["boostTier"];
  boostStartedHoursAgo?: number;
  boostEndsInHours?: number;
  highlightEndsInHours?: number;
  featuredEndsInHours?: number;
}

export const SEEDS: Seed[] = [
  // ── Permanent slots (#1, #2 and #5 intentionally unsold) ────────────────
  {
    id: "demo-skinstel",
    name: "Skinstel",
    url: "https://skinstel.com",
    description: "Skincare that's actually matched to your skin, not the trend cycle.",
    category: "business",
    clickCount: 318,
    ageDays: 62,
    permanentRank: 3,
    // The showcase row: permanent AND highlighted, so the gold orbit is
    // visible on the live board straight away.
    highlightEndsInHours: 40,
  },
  {
    id: "demo-documenso",
    name: "Documenso",
    url: "https://documenso.com",
    description: "Open-source document signing you can host yourself.",
    category: "saas_tools",
    clickCount: 301,
    ageDays: 54,
    permanentRank: 4,
  },

  // ── Top 10 timed tier ───────────────────────────────────────────────────
  {
    id: "demo-coolify",
    name: "Coolify",
    url: "https://coolify.io",
    description: "Deploy apps and databases to your own servers, no vendor lock-in.",
    category: "saas_tools",
    clickCount: 296,
    ageDays: 45,
    boostTier: "top10",
    boostStartedHoursAgo: 10,
    boostEndsInHours: 62,
  },
  {
    id: "demo-formbricks",
    name: "Formbricks",
    url: "https://formbricks.com",
    description: "Surveys and in-product feedback without shipping data to a third party.",
    category: "saas_tools",
    clickCount: 288,
    ageDays: 30,
    boostTier: "top10",
    boostStartedHoursAgo: 4,
    boostEndsInHours: 8,
  },

  // ── Top 20 timed tier ───────────────────────────────────────────────────
  {
    id: "demo-umami",
    name: "Umami",
    url: "https://umami.is",
    description: "Simple, privacy-first web analytics with no cookie banner.",
    category: "saas_tools",
    clickCount: 279,
    ageDays: 25,
    boostTier: "top20",
    boostStartedHoursAgo: 20,
    boostEndsInHours: 52,
  },
  {
    id: "demo-papermark",
    name: "Papermark",
    url: "https://papermark.io",
    description: "Share documents as links and see exactly who read what.",
    category: "saas_tools",
    clickCount: 271,
    ageDays: 21,
    boostTier: "top20",
    boostStartedHoursAgo: 6,
    boostEndsInHours: 6,
  },

  // ── Top 50 timed tier ───────────────────────────────────────────────────
  {
    id: "demo-anytype",
    name: "Anytype",
    url: "https://anytype.io",
    description: "A local-first workspace for notes, tasks and everything between.",
    category: "content",
    clickCount: 266,
    ageDays: 14,
    boostTier: "top50",
    boostStartedHoursAgo: 2,
    boostEndsInHours: 22,
  },
  {
    id: "demo-penpot",
    name: "Penpot",
    url: "https://penpot.app",
    description: "Open-source design and prototyping that speaks real CSS.",
    category: "saas_tools",
    clickCount: 259,
    ageDays: 12,
    boostTier: "top50",
    boostStartedHoursAgo: 1,
    boostEndsInHours: 5,
  },

  // ── Lapsed boosts ───────────────────────────────────────────────────────
  // boostTier is still set but boostExpiresAt is in the past, so these fall
  // out of the tier ladder into the open section and the row offers the slot
  // they just vacated. One per tier, so all three prices are demonstrated.
  {
    id: "demo-buttondown",
    name: "Buttondown",
    url: "https://buttondown.com",
    description: "A newsletter tool that stays out of the way of the writing.",
    category: "content",
    clickCount: 284,
    ageDays: 33,
    boostTier: "top10",
    boostStartedHoursAgo: 96,
    boostEndsInHours: -9,
  },
  {
    id: "demo-turso",
    name: "Turso",
    url: "https://turso.tech",
    description: "SQLite on the edge — databases that sit next to your users.",
    category: "saas_tools",
    clickCount: 263,
    ageDays: 27,
    boostTier: "top20",
    boostStartedHoursAgo: 120,
    boostEndsInHours: -26,
  },
  {
    id: "demo-peerlist",
    name: "Peerlist",
    url: "https://peerlist.io",
    description: "A professional network built around what you have actually shipped.",
    category: "communities",
    clickCount: 250,
    ageDays: 19,
    boostTier: "top50",
    boostStartedHoursAgo: 30,
    boostEndsInHours: -4,
  },

  // ── Open section (free listings) ────────────────────────────────────────
  {
    id: "demo-codeberg",
    name: "Codeberg",
    url: "https://codeberg.org",
    description: "Community-run code hosting for free and open-source projects.",
    category: "saas_tools",
    clickCount: 254,
    ageDays: 10,
    featuredEndsInHours: 18,
  },
  {
    id: "demo-polar",
    name: "Polar",
    url: "https://polar.sh",
    description: "Billing and payouts built for people shipping developer tools.",
    category: "business",
    clickCount: 251,
    ageDays: 9,
  },
  {
    id: "demo-lobsters",
    name: "Lobsters",
    url: "https://lobste.rs",
    description: "A small, invite-only community reading about computing.",
    category: "communities",
    clickCount: 248,
    ageDays: 8,
  },
  {
    id: "demo-baseten",
    name: "Baseten",
    url: "https://baseten.co",
    description: "Deploy and scale machine-learning models without the plumbing.",
    category: "ai_automation",
    clickCount: 246,
    ageDays: 7,
  },
  {
    id: "demo-zen",
    name: "Zen Browser",
    url: "https://zen-browser.app",
    description: "A calm, Firefox-based browser that keeps tabs out of your way.",
    category: "other",
    clickCount: 243,
    ageDays: 6,
  },
  {
    id: "demo-tinybird",
    name: "Tinybird",
    url: "https://tinybird.co",
    description: "Turn streaming data into fast APIs without running the database.",
    category: "saas_tools",
    clickCount: 241,
    ageDays: 5,
  },
  {
    id: "demo-openalternative",
    name: "OpenAlternative",
    url: "https://openalternative.co",
    description: "A directory of open-source replacements for the tools you pay for.",
    category: "directories",
    clickCount: 239,
    ageDays: 4,
  },
  {
    id: "demo-bearblog",
    name: "Bear Blog",
    url: "https://bearblog.dev",
    description: "A blogging platform with no trackers, no ads and no JavaScript.",
    category: "content",
    clickCount: 238,
    ageDays: 3,
  },
];

/**
 * Turns one seed into a full Listing. Shared with starter-data.ts so the
 * bootstrap set (real DB configured, table still empty) is computed the same
 * way as the demo set instead of a hand-copied duplicate that can drift.
 * `id` is taken separately from the seed so a caller can remap the
 * "demo-"/"starter-" namespace without touching SEEDS itself.
 */
export function buildListing(s: Seed, id: string, now: number): Listing {
  return {
    id,
    name: s.name,
    url: s.url,
    description: s.description,
    // Derived from the URL, exactly like a real listing created at checkout.
    logoUrl: faviconUrl(s.url),
    category: s.category,
    status: "active" as const,
    permanentRank: s.permanentRank ?? null,
    boostTier: s.boostTier ?? null,
    boostStartedAt:
      s.boostStartedHoursAgo !== undefined
        ? iso(-s.boostStartedHoursAgo * h, now)
        : null,
    boostExpiresAt:
      s.boostEndsInHours !== undefined ? iso(s.boostEndsInHours * h, now) : null,
    highlightExpiresAt:
      s.highlightEndsInHours !== undefined
        ? iso(s.highlightEndsInHours * h, now)
        : null,
    featuredOpenExpiresAt:
      s.featuredEndsInHours !== undefined
        ? iso(s.featuredEndsInHours * h, now)
        : null,
    clickCount: s.clickCount,
    createdAt: iso(-s.ageDays * 24 * h, now),
  };
}

export function demoListings(): Listing[] {
  const now = Date.now();
  return SEEDS.map((s) => buildListing(s, s.id, now));
}

/** Deterministic, clearly-synthetic live visitor figure for demo mode. */
export function demoVisitorCount(): number {
  const minute = Math.floor(Date.now() / 60000);
  return 34 + (minute % 23);
}

export const DEMO_REVENUE_CENTS = 1_284_100;
