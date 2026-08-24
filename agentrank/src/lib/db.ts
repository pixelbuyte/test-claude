/**
 * Data access layer. All reads and writes go through here so the rest of the
 * app never touches Supabase directly. When Supabase env vars are absent the
 * read paths serve fictional demo data (clearly labeled in the UI) and the
 * write paths throw DemoModeError, which API routes turn into a friendly 503.
 */

import { getCatalogItem, TIER_CAPACITY, type Tier } from "@/lib/pricing";
import { countActiveBoosts } from "@/lib/ranking";
import { isDbConfigured, supabaseAdmin } from "@/lib/supabase";
import { demoListings, demoVisitorCount, DEMO_REVENUE_CENTS } from "@/lib/demo-data";
import type { Listing, Payment, SubmitListingInput } from "@/lib/types";

export class DemoModeError extends Error {
  constructor() {
    super(
      "This deployment is running on demo data. Configure Supabase and Stripe environment variables to enable listings and payments.",
    );
    this.name = "DemoModeError";
  }
}

export const demoMode = () => !isDbConfigured();

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToListing(row: any): Listing {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description ?? "",
    logoUrl: row.logo_url ?? null,
    category: row.category ?? "other",
    status: row.status,
    permanentRank: row.permanent_rank ?? null,
    boostTier: row.boost_tier ?? null,
    boostStartedAt: row.boost_started_at ?? null,
    boostExpiresAt: row.boost_expires_at ?? null,
    highlightExpiresAt: row.highlight_expires_at ?? null,
    featuredOpenExpiresAt: row.featured_open_expires_at ?? null,
    clickCount: row.click_count ?? 0,
    createdAt: row.created_at,
  };
}

function rowToPayment(row: any): Payment {
  return {
    id: row.id,
    listingId: row.listing_id ?? null,
    sku: row.sku,
    amountCents: row.amount_cents,
    status: row.status,
    stripeSessionId: row.stripe_session_id ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Reads ──────────────────────────────────────────────────────────────────

export async function getActiveListings(): Promise<Listing[]> {
  if (demoMode()) return demoListings();
  const { data, error } = await supabaseAdmin()
    .from("listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(rowToListing);
}

export async function getAllListings(): Promise<Listing[]> {
  if (demoMode()) return demoListings();
  const { data, error } = await supabaseAdmin()
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToListing);
}

export async function getListing(id: string): Promise<Listing | null> {
  if (demoMode()) return demoListings().find((l) => l.id === id) ?? null;
  const { data, error } = await supabaseAdmin()
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToListing(data) : null;
}

export async function getLiveVisitorCount(): Promise<number> {
  if (demoMode()) return demoVisitorCount();
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count, error } = await supabaseAdmin()
    .from("presence")
    .select("anon_id", { count: "exact", head: true })
    .gt("seen_at", cutoff);
  if (error) throw error;
  return count ?? 0;
}

export async function getTotalRevenueCents(): Promise<number> {
  if (demoMode()) return DEMO_REVENUE_CENTS;
  const { data, error } = await supabaseAdmin()
    .from("payments")
    .select("amount_cents")
    .eq("status", "completed");
  if (error) throw error;
  return data.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
}

export async function getPayments(): Promise<Payment[]> {
  if (demoMode()) return [];
  const { data, error } = await supabaseAdmin()
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map(rowToPayment);
}

// ── Writes ─────────────────────────────────────────────────────────────────

export async function createListing(
  input: SubmitListingInput,
): Promise<Listing> {
  if (demoMode()) throw new DemoModeError();
  const requireReview = process.env.REQUIRE_LISTING_REVIEW === "true";
  const { data, error } = await supabaseAdmin()
    .from("listings")
    .insert({
      name: input.name,
      url: input.url,
      description: input.description,
      logo_url: input.logoUrl ?? null,
      category: input.category,
      owner_email: input.ownerEmail ?? null,
      status: requireReview ? "pending" : "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToListing(data);
}

export async function recordPendingPayment(params: {
  stripeSessionId: string;
  sku: string;
  amountCents: number;
  listingId: string;
}): Promise<void> {
  if (demoMode()) throw new DemoModeError();
  const { error } = await supabaseAdmin().from("payments").insert({
    stripe_session_id: params.stripeSessionId,
    sku: params.sku,
    amount_cents: params.amountCents,
    listing_id: params.listingId,
    status: "pending",
  });
  if (error) throw error;
}

export async function incrementClick(id: string): Promise<string | null> {
  if (demoMode()) {
    return demoListings().find((l) => l.id === id)?.url ?? null;
  }
  const { data, error } = await supabaseAdmin().rpc("increment_click", {
    listing_id: id,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function heartbeat(anonId: string): Promise<void> {
  if (demoMode()) return;
  const { error } = await supabaseAdmin()
    .from("presence")
    .upsert({ anon_id: anonId, seen_at: new Date().toISOString() });
  if (error) throw error;
}

// ── Purchase application (called from the Stripe webhook) ──────────────────

export type ApplyResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Applies a completed purchase to a listing. Availability is re-checked here
 * (not just at checkout) so a race between two buyers can never hand out the
 * same permanent rank or oversell a tier — the loser is flagged "conflict"
 * for the admin to refund.
 */
export async function applyPurchase(params: {
  sku: string;
  listingId: string;
}): Promise<ApplyResult> {
  if (demoMode()) throw new DemoModeError();
  const item = getCatalogItem(params.sku);
  if (!item) return { ok: false, reason: `Unknown sku ${params.sku}` };

  const db = supabaseAdmin();
  const listing = await getListing(params.listingId);
  if (!listing) return { ok: false, reason: "Listing not found" };
  const now = new Date();

  if (item.kind === "permanent") {
    // The partial unique index on permanent_rank makes the race safe: if two
    // webhooks try to claim the same rank, the second update errors.
    const { error } = await db
      .from("listings")
      .update({ permanent_rank: item.rank, status: "active" })
      .eq("id", listing.id);
    if (error) {
      return { ok: false, reason: `Permanent rank ${item.rank} is already owned` };
    }
    return { ok: true };
  }

  if (item.kind === "tier_boost") {
    const tier = item.tier as Tier;
    const all = await getActiveListings();
    const othersInTier = countActiveBoosts(
      all.filter((l) => l.id !== listing.id),
      tier,
      now,
    );
    if (othersInTier >= TIER_CAPACITY[tier]) {
      return { ok: false, reason: `${tier} tier is full` };
    }
    const sameTierActive =
      listing.boostTier === tier &&
      listing.boostExpiresAt &&
      new Date(listing.boostExpiresAt) > now;
    // Same-tier repurchase extends the existing placement and keeps the
    // listing's first-come queue position; switching tiers starts fresh.
    const startedAt = sameTierActive
      ? listing.boostStartedAt
      : now.toISOString();
    const baseMs = sameTierActive
      ? new Date(listing.boostExpiresAt!).getTime()
      : now.getTime();
    const expiresAt = new Date(
      baseMs + item.durationHours! * 3600_000,
    ).toISOString();
    const { error } = await db
      .from("listings")
      .update({
        boost_tier: tier,
        boost_started_at: startedAt,
        boost_expires_at: expiresAt,
        status: "active",
      })
      .eq("id", listing.id);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  }

  // Highlight and featured-open both stack onto any existing time remaining.
  const column =
    item.kind === "highlight" ? "highlight_expires_at" : "featured_open_expires_at";
  const existing =
    item.kind === "highlight"
      ? listing.highlightExpiresAt
      : listing.featuredOpenExpiresAt;
  const baseMs = Math.max(
    now.getTime(),
    existing ? new Date(existing).getTime() : 0,
  );
  const expiresAt = new Date(baseMs + item.durationHours! * 3600_000).toISOString();
  const { error } = await db
    .from("listings")
    .update({ [column]: expiresAt })
    .eq("id", listing.id);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function completePayment(params: {
  stripeSessionId: string;
  status: "completed" | "conflict";
}): Promise<{ alreadyProcessed: boolean }> {
  if (demoMode()) throw new DemoModeError();
  const { data, error } = await supabaseAdmin()
    .from("payments")
    .update({
      status: params.status,
      completed_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", params.stripeSessionId)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return { alreadyProcessed: (data ?? []).length === 0 };
}

// ── Admin ──────────────────────────────────────────────────────────────────

export async function setListingStatus(
  id: string,
  status: "active" | "rejected",
): Promise<void> {
  if (demoMode()) throw new DemoModeError();
  const { error } = await supabaseAdmin()
    .from("listings")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function clearPlacements(id: string): Promise<void> {
  if (demoMode()) throw new DemoModeError();
  const { error } = await supabaseAdmin()
    .from("listings")
    .update({
      permanent_rank: null,
      boost_tier: null,
      boost_started_at: null,
      boost_expires_at: null,
      highlight_expires_at: null,
      featured_open_expires_at: null,
    })
    .eq("id", id);
  if (error) throw error;
}
