/**
 * Bootstrap board content: real Supabase is connected, but the `listings`
 * table is genuinely empty — nobody has bought or listed anything yet. That
 * is the correct state for a brand-new deployment, but an empty board reads
 * as broken rather than new, so this fills it with a starting set until the
 * first real row exists.
 *
 * Built from demo-data.ts's SEEDS rather than a hand-copied duplicate, so the
 * two can't drift apart. Two differences from the demo set:
 *
 * 1. IDs are namespaced "starter-" instead of "demo-", so a click on one of
 *    these rows can be told apart from a real listing (see incrementClick in
 *    db.ts, which needs that to redirect a starter row correctly instead of
 *    trying — and failing — to record a click against a database row that
 *    doesn't exist).
 * 2. The three seeds with a lapsed boost (boostEndsInHours < 0) are dropped.
 *    They exist in demo-data.ts specifically to show off the "expired
 *    placement" feature; on a genuine launch day, three rows reading
 *    "TOP 10 · EXPIRED" before anyone has bought anything reads as the site
 *    already being stale, which is the opposite of the intent here.
 *
 * Only page.tsx decides when to serve this, and only for what the public
 * board renders — getActiveListings()/getPermanentRankOwners() in db.ts stay
 * real-DB-only everywhere else (checkout's tier-capacity check, the
 * submit-listing "upgrade an existing listing" picker, /pricing's slot
 * counts), because those gate or display real money-moving decisions and
 * must never be told a starter row exists. page.tsx swaps this in only when
 * the real listings table has zero rows total and nobody holds a permanent
 * rank in any status — the moment either becomes untrue (a free listing, a
 * purchase), the next request stops serving this. No cleanup step, no flag
 * to unset by hand.
 */

import { buildListing, SEEDS } from "@/lib/demo-data";
import type { Listing } from "@/lib/types";

const STARTER_SEEDS = SEEDS.filter(
  (s) => s.boostEndsInHours === undefined || s.boostEndsInHours >= 0,
);

export function starterListings(): Listing[] {
  const now = Date.now();
  return STARTER_SEEDS.map((s) =>
    buildListing(s, s.id.replace(/^demo-/, "starter-"), now),
  );
}
