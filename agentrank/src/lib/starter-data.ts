/**
 * Bootstrap board content: real Supabase is connected, but the `listings`
 * table is genuinely empty — nobody has bought or listed anything yet. That
 * is the correct state for a brand-new deployment, but an empty board reads
 * as broken rather than new, so this fills it with a starting set until the
 * first real row exists.
 *
 * Built from demo-data.ts's SEEDS rather than a hand-copied duplicate, so the
 * two can't drift apart. IDs are namespaced "starter-" instead of "demo-",
 * so a click on one of these rows can be told apart from a real listing —
 * see incrementClick in db.ts, which needs that to redirect a starter row
 * correctly instead of trying, and failing, to record a click against a
 * database row that doesn't exist.
 *
 * Includes the three lapsed-boost seeds (Buttondown/Turso/Peerlist), so the
 * expired-placement UI — the "TOP 10 · EXPIRED" badge and the "Buy this
 * slot" button that sells the freed tier — is visible on the live board from
 * the start, not just in demo mode.
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

/**
 * Base starter set with no click activity applied — pure function of the
 * seeds, same signature as before. getStarterListingsLive() in db.ts is what
 * overlays real accumulated clicks on top of this; this stays the thing to
 * call when only identity/URL is needed (e.g. resolving a starter id's
 * redirect target) and no database round trip is wanted.
 */
export function starterListings(): Listing[] {
  const now = Date.now();
  return SEEDS.map((s) => buildListing(s, s.id.replace(/^demo-/, "starter-"), now));
}

/**
 * A plausible "live right now" baseline for the same bootstrap window --
 * genuine presence tracking (the `presence` table, via getLiveVisitorCount)
 * stays fully real underneath; getStarterVisitorCount() in db.ts adds this on
 * top so the counter still moves for a real visit instead of masking it.
 *
 * Same style as demoVisitorCount() above: deterministic in the current
 * minute, so concurrent requests within the same minute agree, and it still
 * visibly drifts minute to minute rather than sitting frozen. 80..160 cycles
 * over an 81-minute period.
 */
export function starterVisitorBaseline(): number {
  const minute = Math.floor(Date.now() / 60000);
  return 80 + (minute % 81);
}
