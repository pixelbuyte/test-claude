/**
 * Data access layer. All reads and writes go through here so the rest of the
 * app never touches Supabase directly. When Supabase env vars are absent the
 * read paths serve fictional demo data (clearly labeled in the UI) and the
 * write paths throw DemoModeError, which API routes turn into a friendly 503.
 */

import { getCatalogItem, TIER_CAPACITY, type Tier } from "@/lib/pricing";
import { isDbConfigured, supabaseAdmin } from "@/lib/supabase";
import {
  demoListings,
  demoVisitorCount,
  DEMO_REVENUE_CENTS,
} from "@/lib/demo-data";
import { starterListings } from "@/lib/starter-data";
import type { Listing, Payment, SubmitListingInput } from "@/lib/types";
import { urlMatchKey } from "@/lib/utils";

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

/**
 * Accumulated real clicks on starter-mode rows since they started serving,
 * keyed by starter id — written by incrementStarterClick below, one settings
 * row per id ("starter_click:<id>"). Read with a prefix match rather than
 * one row per id fetched individually, so the board's single page load stays
 * a single query no matter how many starter rows are showing.
 */
async function getStarterClickDeltas(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin()
    .from("settings")
    .select("key, value")
    .like("key", "starter_click:%");
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of data) {
    const id = row.key.replace(/^starter_click:/, "");
    const count = (row.value as { count?: unknown } | null)?.count;
    out[id] = typeof count === "number" ? count : 0;
  }
  return out;
}

/**
 * The starter set with real accumulated clicks laid on top of each seed's
 * starting count, so a click someone actually makes is reflected on the next
 * page load rather than the number sitting frozen at its seed value forever.
 */
export async function getStarterListingsLive(): Promise<Listing[]> {
  const deltas = await getStarterClickDeltas();
  return starterListings().map((l) =>
    deltas[l.id] ? { ...l, clickCount: l.clickCount + deltas[l.id] } : l,
  );
}

/**
 * Atomically bumps a starter row's persisted click count and returns the new
 * total. Not gated on demoMode()/isDbConfigured() by the caller needing to
 * check first -- incrementClick already only reaches this for a real,
 * DB-configured deployment (see the id.startsWith("starter-") branch there).
 */
async function incrementStarterClick(id: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("increment_starter_click", {
    p_id: id,
  });
  if (error) throw error;
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

/**
 * Finds any listing (regardless of status) whose URL matches, ignoring
 * protocol/www/trailing-slash/query differences — this is what makes buying
 * a placement for an already-listed URL upgrade it in place instead of
 * creating a duplicate.
 */
export async function findListingByUrl(url: string): Promise<Listing | null> {
  const key = urlMatchKey(url);
  if (demoMode()) {
    return demoListings().find((l) => urlMatchKey(l.url) === key) ?? null;
  }
  const { data, error } = await supabaseAdmin()
    .from("listings")
    .select("*")
    .eq("url_key", key)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToListing(data) : null;
}

export interface PermanentRankOwner {
  id: string;
  name: string;
  status: Listing["status"];
  clickCount: number;
}

/** Every row currently holding a permanent rank (1–5), any status — lets the
 * pricing/board pages tell "available" apart from "held by an inactive
 * listing", which the naive active-only check would render as available. */
export async function getPermanentRankOwners(): Promise<
  Record<number, PermanentRankOwner>
> {
  if (demoMode()) {
    const out: Record<number, PermanentRankOwner> = {};
    for (const l of demoListings()) {
      if (l.permanentRank !== null) {
        out[l.permanentRank] = {
          id: l.id,
          name: l.name,
          status: l.status,
          clickCount: l.clickCount,
        };
      }
    }
    return out;
  }
  const { data, error } = await supabaseAdmin()
    .from("listings")
    .select("id, name, status, click_count, permanent_rank")
    .not("permanent_rank", "is", null);
  if (error) throw error;
  const out: Record<number, PermanentRankOwner> = {};
  for (const row of data) {
    out[row.permanent_rank as number] = {
      id: row.id,
      name: row.name,
      status: row.status,
      clickCount: row.click_count ?? 0,
    };
  }
  return out;
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
  // Demo mode still redirects, but has nowhere to record the click — see the
  // note on SEEDS in demo-data.ts.
  if (demoMode()) {
    return demoListings().find((l) => l.id === id)?.url ?? null;
  }
  // A starter-mode row has no real listings row to run the real
  // increment_click RPC against -- that RPC would match nothing and this
  // would silently bounce the visitor home instead of redirecting to the
  // site they clicked. Checked by id prefix, not by re-deriving bootstrap
  // state here: a click can land after the page that served this row was
  // rendered but the board has since moved past bootstrap (a real purchase
  // just landed), and this row should still resolve correctly regardless of
  // what the board would show right now.
  //
  // The click itself is still real, so it's still counted -- just against
  // its own counter (increment_starter_click / the settings table) instead
  // of a listings row. If that write fails, the visitor still gets
  // redirected: a missed count is a rendering detail, a broken "Visit" link
  // on someone else's click is not an acceptable trade for it.
  if (id.startsWith("starter-")) {
    const url = starterListings().find((l) => l.id === id)?.url ?? null;
    if (url) {
      try {
        await incrementStarterClick(id);
      } catch (err) {
        console.error("Starter click tracking error", err);
      }
    }
    return url;
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
  // Opportunistic prune keeps the table bounded even without pg_cron.
  if (Math.random() < 0.05) {
    const cutoff = new Date(Date.now() - 3600_000).toISOString();
    await supabaseAdmin().from("presence").delete().lt("seen_at", cutoff);
  }
}

// ── Purchase application (called from the Stripe webhook) ──────────────────

export type ApplyResult =
  | { ok: true }
  | { ok: false; reason: string };

const TIER_PRIORITY: Record<Tier, number> = { top10: 3, top20: 2, top50: 1 };

/** True when any listing (regardless of status) holds the permanent rank —
 * a rejected holder still owns the row until an admin clears it. */
export async function isPermanentRankTaken(rank: number): Promise<boolean> {
  if (demoMode()) {
    return demoListings().some((l) => l.permanentRank === rank);
  }
  const { count, error } = await supabaseAdmin()
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("permanent_rank", rank);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Applies a paid purchase to a listing.
 *
 * Guarantees: a genuine loss of availability (rank taken, tier full, listing
 * rejected, would-be downgrade) returns ok:false so the webhook flags the
 * payment "conflict" for a refund; a transient failure THROWS so the webhook
 * can 500 and let Stripe retry. Rank races are settled by the partial unique
 * index on permanent_rank; tier capacity races by the apply_tier_boost
 * function's advisory lock — neither can ever double-sell.
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
  if (listing.status === "rejected") {
    // Payment never resurrects a moderated-away listing.
    return { ok: false, reason: "Listing was rejected by moderation" };
  }
  const now = new Date();

  if (item.kind === "permanent") {
    const { error } = await db
      .from("listings")
      .update({ permanent_rank: item.rank, status: "active" })
      .eq("id", listing.id);
    if (error) {
      // 23505 = unique_violation on the permanent_rank partial index: the
      // rank was genuinely won by someone else. Anything else is transient.
      if (error.code === "23505") {
        return { ok: false, reason: `Permanent rank ${item.rank} is already owned` };
      }
      throw error;
    }
    return { ok: true };
  }

  if (item.kind === "tier_boost") {
    const tier = item.tier as Tier;
    if (listing.permanentRank !== null) {
      return {
        ok: false,
        reason: "Listing already holds a permanent rank — a tier boost would have no effect",
      };
    }
    const activeBoost =
      listing.boostTier !== null &&
      listing.boostExpiresAt !== null &&
      new Date(listing.boostExpiresAt) > now;
    if (activeBoost && TIER_PRIORITY[tier] < TIER_PRIORITY[listing.boostTier!]) {
      // A cheap purchase must never pull an active higher-tier placement
      // down — that would let anyone sabotage another buyer's slot.
      return {
        ok: false,
        reason: `Listing already holds an active ${listing.boostTier} placement — a ${tier} boost would downgrade it`,
      };
    }
    const sameTierActive = activeBoost && listing.boostTier === tier;
    // Same-tier repurchase extends the placement and keeps the listing's
    // first-come queue position; an upgrade starts fresh from now.
    const startedAt = sameTierActive
      ? listing.boostStartedAt
      : now.toISOString();
    const baseMs = sameTierActive
      ? new Date(listing.boostExpiresAt!).getTime()
      : now.getTime();
    const expiresAt = new Date(
      baseMs + item.durationHours! * 3600_000,
    ).toISOString();
    const { data: claimed, error } = await db.rpc("apply_tier_boost", {
      p_listing_id: listing.id,
      p_tier: tier,
      p_capacity: TIER_CAPACITY[tier],
      p_started_at: startedAt,
      p_expires_at: expiresAt,
    });
    if (error) throw error;
    if (!claimed) return { ok: false, reason: `${tier} tier is full` };
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
  if (error) throw error;
  return { ok: true };
}

/**
 * Atomically claims a pending payment (pending → completed). The webhook
 * claims BEFORE applying the purchase, which makes duplicate Stripe
 * deliveries no-ops — they see alreadyProcessed and never touch the listing.
 */
export async function claimPayment(
  stripeSessionId: string,
): Promise<{ alreadyProcessed: boolean }> {
  if (demoMode()) throw new DemoModeError();
  const { data, error } = await supabaseAdmin()
    .from("payments")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", stripeSessionId)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return { alreadyProcessed: (data ?? []).length === 0 };
}

/** Rolls a claim back to pending so a Stripe retry can process it again
 * after a transient failure. */
export async function releasePaymentClaim(stripeSessionId: string): Promise<void> {
  if (demoMode()) throw new DemoModeError();
  const { error } = await supabaseAdmin()
    .from("payments")
    .update({ status: "pending", completed_at: null })
    .eq("stripe_session_id", stripeSessionId)
    .eq("status", "completed");
  if (error) throw error;
}

/** Marks a claimed payment with a terminal non-success status
 * ("conflict" → refund it in Stripe; "failed" → async payment never landed). */
export async function markPayment(
  stripeSessionId: string,
  status: "conflict" | "failed",
): Promise<void> {
  if (demoMode()) throw new DemoModeError();
  const { error } = await supabaseAdmin()
    .from("payments")
    .update({ status, completed_at: new Date().toISOString() })
    .eq("stripe_session_id", stripeSessionId)
    .neq("status", "refunded");
  if (error) throw error;
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

export async function setListingCategory(
  id: string,
  category: string,
): Promise<void> {
  if (demoMode()) throw new DemoModeError();
  const { error } = await supabaseAdmin()
    .from("listings")
    .update({ category })
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
