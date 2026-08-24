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

/** Seed rows: real sites, and click counts in a believable early-days band
 * (a few hundred each) rather than implausible five-figure numbers. The live
 * counter then increments from whatever a listing is already sitting at. */
interface Seed {
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

const SEEDS: Seed[] = [
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
    id: "demo-linear",
    name: "Linear",
    url: "https://linear.app",
    description: "Purpose-built tool for planning and building products.",
    category: "saas_tools",
    clickCount: 301,
    ageDays: 54,
    permanentRank: 4,
  },

  // ── Top 10 timed tier ───────────────────────────────────────────────────
  {
    id: "demo-vercel",
    name: "Vercel",
    url: "https://vercel.com",
    description: "The complete platform to build, scale and secure web apps.",
    category: "saas_tools",
    clickCount: 296,
    ageDays: 45,
    boostTier: "top10",
    boostStartedHoursAgo: 10,
    boostEndsInHours: 62,
  },
  {
    id: "demo-resend",
    name: "Resend",
    url: "https://resend.com",
    description: "The email API for developers who care about deliverability.",
    category: "saas_tools",
    clickCount: 288,
    ageDays: 30,
    boostTier: "top10",
    boostStartedHoursAgo: 4,
    boostEndsInHours: 8,
  },

  // ── Top 20 timed tier ───────────────────────────────────────────────────
  {
    id: "demo-supabase",
    name: "Supabase",
    url: "https://supabase.com",
    description: "The open source Firebase alternative — Postgres, auth, storage.",
    category: "saas_tools",
    clickCount: 279,
    ageDays: 25,
    boostTier: "top20",
    boostStartedHoursAgo: 20,
    boostEndsInHours: 52,
  },
  {
    id: "demo-raycast",
    name: "Raycast",
    url: "https://raycast.com",
    description: "A blazingly fast launcher that replaces your clipboard and more.",
    category: "saas_tools",
    clickCount: 271,
    ageDays: 21,
    boostTier: "top20",
    boostStartedHoursAgo: 6,
    boostEndsInHours: 6,
  },

  // ── Top 50 timed tier ───────────────────────────────────────────────────
  {
    id: "demo-posthog",
    name: "PostHog",
    url: "https://posthog.com",
    description: "Product analytics, session replay and feature flags in one place.",
    category: "saas_tools",
    clickCount: 266,
    ageDays: 14,
    boostTier: "top50",
    boostStartedHoursAgo: 2,
    boostEndsInHours: 22,
  },
  {
    id: "demo-cal",
    name: "Cal.com",
    url: "https://cal.com",
    description: "Open scheduling infrastructure — book meetings without the ping-pong.",
    category: "saas_tools",
    clickCount: 259,
    ageDays: 12,
    boostTier: "top50",
    boostStartedHoursAgo: 1,
    boostEndsInHours: 5,
  },

  // ── Open section (free listings) ────────────────────────────────────────
  {
    id: "demo-notion",
    name: "Notion",
    url: "https://notion.so",
    description: "One workspace for your docs, projects and knowledge.",
    category: "content",
    clickCount: 254,
    ageDays: 10,
    featuredEndsInHours: 18,
  },
  {
    id: "demo-github",
    name: "GitHub",
    url: "https://github.com",
    description: "Build and ship software on a single, collaborative platform.",
    category: "saas_tools",
    clickCount: 251,
    ageDays: 9,
  },
  {
    id: "demo-figma",
    name: "Figma",
    url: "https://figma.com",
    description: "The collaborative interface design tool, right in the browser.",
    category: "saas_tools",
    clickCount: 248,
    ageDays: 8,
  },
  {
    id: "demo-stripe",
    name: "Stripe",
    url: "https://stripe.com",
    description: "Financial infrastructure to grow your revenue.",
    category: "business",
    clickCount: 246,
    ageDays: 7,
  },
  {
    id: "demo-hn",
    name: "Hacker News",
    url: "https://news.ycombinator.com",
    description: "What the startup and engineering world is reading right now.",
    category: "communities",
    clickCount: 243,
    ageDays: 6,
  },
  {
    id: "demo-producthunt",
    name: "Product Hunt",
    url: "https://producthunt.com",
    description: "Discover the newest products shipping every single day.",
    category: "directories",
    clickCount: 241,
    ageDays: 5,
  },
  {
    id: "demo-hf",
    name: "Hugging Face",
    url: "https://huggingface.co",
    description: "Models, datasets and demos for the open machine-learning community.",
    category: "ai_automation",
    clickCount: 239,
    ageDays: 4,
  },
  {
    id: "demo-arc",
    name: "Arc Browser",
    url: "https://arc.net",
    description: "A browser that organises your tabs instead of hoarding them.",
    category: "other",
    clickCount: 238,
    ageDays: 3,
  },
];

export function demoListings(): Listing[] {
  const now = Date.now();
  return SEEDS.map((s) => ({
    id: s.id,
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
  }));
}

/** Deterministic, clearly-synthetic live visitor figure for demo mode. */
export function demoVisitorCount(): number {
  const minute = Math.floor(Date.now() / 60000);
  return 34 + (minute % 23);
}

export const DEMO_REVENUE_CENTS = 1_284_100;
