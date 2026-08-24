/**
 * Demo board data used when Supabase env vars are absent, so a fresh clone
 * renders a fully populated, working board. Every listing here is fictional —
 * the UI shows a "Demo data" badge whenever this module is serving.
 */

import type { Listing } from "@/lib/types";

const h = 3600_000;

function iso(offsetMs: number, now: number): string {
  return new Date(now + offsetMs).toISOString();
}

export function demoListings(): Listing[] {
  const now = Date.now();
  const base = {
    status: "active" as const,
    logoUrl: null,
    permanentRank: null,
    boostTier: null,
    boostStartedAt: null,
    boostExpiresAt: null,
    highlightExpiresAt: null,
    featuredOpenExpiresAt: null,
  };

  return [
    {
      ...base,
      id: "demo-01",
      name: "Northstar Agents",
      url: "https://example.com/northstar",
      description: "Autonomous research agents that brief your team every morning.",
      category: "ai_agents",
      permanentRank: 1,
      clickCount: 4821,
      createdAt: iso(-90 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-02",
      name: "Relayforge",
      url: "https://example.com/relayforge",
      description: "Workflow automation that wires your whole stack together in minutes.",
      category: "workflow_automation",
      permanentRank: 2,
      clickCount: 3377,
      createdAt: iso(-80 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-03",
      name: "Deskmate AI",
      url: "https://example.com/deskmate",
      description: "Customer support agent that resolves 70% of tickets end-to-end.",
      category: "customer_support",
      permanentRank: 4,
      clickCount: 2954,
      createdAt: iso(-60 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-04",
      name: "Patchwright",
      url: "https://example.com/patchwright",
      description: "Coding agent that turns issues into reviewed pull requests.",
      category: "coding_agents",
      boostTier: "top10",
      boostStartedAt: iso(-10 * h, now),
      boostExpiresAt: iso(62 * h, now),
      highlightExpiresAt: iso(14 * h, now),
      clickCount: 1968,
      createdAt: iso(-45 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-05",
      name: "Quotaflow",
      url: "https://example.com/quotaflow",
      description: "Sales agents that research, personalize, and book meetings for you.",
      category: "sales_agents",
      boostTier: "top10",
      boostStartedAt: iso(-4 * h, now),
      boostExpiresAt: iso(8 * h, now),
      clickCount: 1544,
      createdAt: iso(-30 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-06",
      name: "Loopcraft",
      url: "https://example.com/loopcraft",
      description: "Visual builder for multi-step AI automations with human approval.",
      category: "workflow_automation",
      boostTier: "top20",
      boostStartedAt: iso(-20 * h, now),
      boostExpiresAt: iso(52 * h, now),
      clickCount: 1102,
      createdAt: iso(-25 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-07",
      name: "Signalpost",
      url: "https://example.com/signalpost",
      description: "Inbox agent that triages, drafts, and follows up on your email.",
      category: "ai_agents",
      boostTier: "top20",
      boostStartedAt: iso(-6 * h, now),
      boostExpiresAt: iso(6 * h, now),
      clickCount: 874,
      createdAt: iso(-21 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-08",
      name: "Bricklayer Bots",
      url: "https://example.com/bricklayer",
      description: "QA agents that write and maintain your end-to-end test suites.",
      category: "coding_agents",
      boostTier: "top50",
      boostStartedAt: iso(-2 * h, now),
      boostExpiresAt: iso(22 * h, now),
      clickCount: 640,
      createdAt: iso(-14 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-09",
      name: "Wardenline",
      url: "https://example.com/wardenline",
      description: "On-call agent that triages alerts and drafts incident timelines.",
      category: "other",
      boostTier: "top50",
      boostStartedAt: iso(-1 * h, now),
      boostExpiresAt: iso(5 * h, now),
      clickCount: 512,
      createdAt: iso(-12 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-10",
      name: "Fieldnote AI",
      url: "https://example.com/fieldnote",
      description: "Meeting agent that captures decisions and pushes them to your CRM.",
      category: "sales_agents",
      featuredOpenExpiresAt: iso(18 * h, now),
      clickCount: 445,
      createdAt: iso(-10 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-11",
      name: "Papertrail Robots",
      url: "https://example.com/papertrail",
      description: "Document agents that extract, validate, and file paperwork.",
      category: "workflow_automation",
      clickCount: 389,
      createdAt: iso(-9 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-12",
      name: "Greeter",
      url: "https://example.com/greeter",
      description: "Website concierge agent that qualifies visitors in real time.",
      category: "customer_support",
      clickCount: 300,
      createdAt: iso(-8 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-13",
      name: "Cartographer",
      url: "https://example.com/cartographer",
      description: "Agent that maps your codebase and answers architecture questions.",
      category: "coding_agents",
      clickCount: 231,
      createdAt: iso(-6 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-14",
      name: "Dispatch Owl",
      url: "https://example.com/dispatch-owl",
      description: "Scheduling agent for field teams — routes, reminders, rebooking.",
      category: "other",
      clickCount: 187,
      createdAt: iso(-5 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-15",
      name: "Ledgerlight",
      url: "https://example.com/ledgerlight",
      description: "Bookkeeping agent that categorizes and reconciles every night.",
      category: "workflow_automation",
      clickCount: 156,
      createdAt: iso(-4 * 24 * h, now),
    },
    {
      ...base,
      id: "demo-16",
      name: "Parrot Desk",
      url: "https://example.com/parrot-desk",
      description: "Multilingual support agent covering 40+ languages out of the box.",
      category: "customer_support",
      clickCount: 98,
      createdAt: iso(-3 * 24 * h, now),
    },
  ];
}

/** Deterministic, clearly-synthetic live visitor figure for demo mode. */
export function demoVisitorCount(): number {
  const minute = Math.floor(Date.now() / 60000);
  return 34 + (minute % 23);
}

export const DEMO_REVENUE_CENTS = 1_284_100;
