import type { Tier } from "@/lib/pricing";

export const CATEGORIES = [
  { slug: "saas_tools", name: "SaaS & Tools" },
  { slug: "ai_automation", name: "AI & Automation" },
  { slug: "directories", name: "Directories & Marketplaces" },
  { slug: "communities", name: "Communities & Forums" },
  { slug: "content", name: "Blogs & Content" },
  { slug: "business", name: "Business & Services" },
  { slug: "other", name: "Other" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? "Other";
}

export type ListingStatus = "pending" | "active" | "rejected";

export interface Listing {
  id: string;
  name: string;
  url: string;
  description: string;
  logoUrl: string | null;
  category: CategorySlug;
  status: ListingStatus;
  /** 1–5 when the listing owns a permanent slot, otherwise null. */
  permanentRank: number | null;
  boostTier: Tier | null;
  /** ISO timestamps; boost fields are set together. */
  boostStartedAt: string | null;
  boostExpiresAt: string | null;
  highlightExpiresAt: string | null;
  featuredOpenExpiresAt: string | null;
  clickCount: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  listingId: string | null;
  sku: string;
  amountCents: number;
  status: "pending" | "completed" | "conflict" | "failed" | "refunded";
  stripeSessionId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface BoardStats {
  totalListings: number;
  totalClicks: number;
  liveVisitors: number;
  /** Null when the revenue counter is disabled. */
  totalRevenueCents: number | null;
  demoMode: boolean;
}

export interface SubmitListingInput {
  name: string;
  url: string;
  description: string;
  logoUrl?: string;
  category: CategorySlug;
  ownerEmail?: string;
}
