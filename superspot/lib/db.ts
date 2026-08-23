import { AdminSettings, Duration, FeaturedClaim, Listing } from "./types";
import { DEFAULT_SETTINGS } from "./pricing";
import { nanoid } from "nanoid";

// ---------------------------------------------------------------------------
// Demo data store: a single in-memory object, kept alive across hot reloads
// via globalThis (the same trick Prisma's docs recommend for dev servers).
//
// SWAP-IN GUIDE: to go to production, replace the functions below with calls
// to Supabase (see schema.sql at the repo root for the equivalent Postgres
// schema + RLS policies). The function signatures are intentionally the
// public surface the rest of the app talks to, so the API routes shouldn't
// need to change much.
// ---------------------------------------------------------------------------

type Store = {
  listings: Map<string, Listing>;
  featured: Map<number, FeaturedClaim>; // spot -> active claim
  settings: AdminSettings;
  revenueCents: number;
};

const g = globalThis as unknown as { __superspotStore?: Store };

function makeListing(
  partial: Partial<Listing> & { url: string; title: string }
): Listing {
  const domain = safeDomain(partial.url);
  return {
    id: partial.id ?? nanoid(10),
    url: partial.url,
    handle: partial.handle ?? null,
    title: partial.title,
    description: partial.description ?? "",
    image: partial.image ?? null,
    favicon:
      partial.favicon ?? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    clicks: partial.clicks ?? 0,
    totalPaid: partial.totalPaid ?? 0,
    createdAt: partial.createdAt ?? Date.now(),
  };
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function seed(): Store {
  const listings = new Map<string, Listing>();

  // Preloaded "top 10 sites" permanent leaderboard, so the page never looks
  // empty on a fresh deploy. Real users can outbid any of these at any time.
  const seedSites: Array<[string, string, string, number]> = [
    ["https://github.com", "GitHub", "Where the world builds software.", 128000],
    ["https://news.ycombinator.com", "Hacker News", "The pulse of the hacker/startup world.", 96500],
    ["https://stripe.com", "Stripe", "Financial infrastructure for the internet.", 89200],
    ["https://vercel.com", "Vercel", "Develop, preview, ship. For the best frontend teams.", 74300],
    ["https://openai.com", "OpenAI", "Research and deployment of safe, useful AI.", 71800],
    ["https://tailwindcss.com", "Tailwind CSS", "Rapidly build modern websites without leaving your HTML.", 58400],
    ["https://x.com", "X", "See what's happening in the world right now.", 52100],
    ["https://www.producthunt.com", "Product Hunt", "The best new products in tech, every day.", 44700],
    ["https://www.reddit.com", "Reddit", "Dive into anything.", 39900],
    ["https://en.wikipedia.org", "Wikipedia", "The free encyclopedia that anyone can edit.", 31200],
  ];

  for (const [url, title, description, totalPaid] of seedSites) {
    const l = makeListing({ url, title, description, totalPaid, clicks: Math.round(totalPaid / 40) });
    listings.set(l.id, l);
  }

  // Two of the five featured spots start pre-claimed so the countdown /
  // "steal" mechanic is visible immediately without any setup.
  const demoFeatured: Array<[string, string, string, number, Duration, number]> = [
    ["https://www.indiehackers.com", "Indie Hackers", "Learn how developers grow to $10k/mo+.", 1, 24, 3200],
    ["https://www.ycombinator.com", "Y Combinator", "Make something people want.", 3, 12, 6300],
  ];

  const featured = new Map<number, FeaturedClaim>();
  const now = Date.now();
  for (const [url, title, description, spot, duration, amountCents] of demoFeatured) {
    const l = makeListing({ url, title, description });
    listings.set(l.id, l);
    const startedAt = now - Math.round(duration * 60 * 60 * 1000 * 0.35); // already ~35% elapsed
    const expiresAt = startedAt + duration * 60 * 60 * 1000;
    featured.set(spot, {
      id: nanoid(10),
      listingId: l.id,
      spot,
      amountCents,
      durationHours: duration,
      startedAt,
      expiresAt,
    });
  }

  const revenueCents =
    seedSites.reduce((sum, s) => sum + s[3], 0) +
    demoFeatured.reduce((sum, d) => sum + d[5], 0);

  return { listings, featured, settings: DEFAULT_SETTINGS, revenueCents };
}

function store(): Store {
  if (!g.__superspotStore) g.__superspotStore = seed();
  sweepExpired(g.__superspotStore);
  return g.__superspotStore;
}

function sweepExpired(s: Store) {
  const now = Date.now();
  for (const [spot, claim] of s.featured) {
    if (claim.expiresAt <= now) s.featured.delete(spot);
  }
}

// --- Listings ---------------------------------------------------------------

export function getOrCreateListing(input: {
  url: string;
  handle?: string | null;
  title: string;
  description?: string;
  image?: string | null;
  favicon?: string | null;
}): Listing {
  const s = store();
  const existing = [...s.listings.values()].find((l) => l.url === input.url);
  if (existing) return existing;
  const l = makeListing({ ...input });
  s.listings.set(l.id, l);
  return l;
}

export function getListing(id: string): Listing | undefined {
  return store().listings.get(id);
}

export function recordClick(id: string): Listing | undefined {
  const s = store();
  const l = s.listings.get(id);
  if (!l) return undefined;
  l.clicks += 1;
  return l;
}

export function permanentLeaderboard(): Listing[] {
  return [...store().listings.values()]
    .filter((l) => l.totalPaid > 0)
    .sort((a, b) => b.totalPaid - a.totalPaid);
}

// --- Featured spots -----------------------------------------------------

export function getFeatured(): Array<{ spot: number; claim: FeaturedClaim | null; listing: Listing | null }> {
  const s = store();
  const out: Array<{ spot: number; claim: FeaturedClaim | null; listing: Listing | null }> = [];
  for (let spot = 1; spot <= 5; spot++) {
    const claim = s.featured.get(spot) ?? null;
    const listing = claim ? s.listings.get(claim.listingId) ?? null : null;
    out.push({ spot, claim, listing });
  }
  return out;
}

export function claimSpot(input: {
  listingId: string;
  spot: number;
  durationHours: Duration;
  amountCents: number;
}): FeaturedClaim {
  const s = store();
  const now = Date.now();
  const claim: FeaturedClaim = {
    id: nanoid(10),
    listingId: input.listingId,
    spot: input.spot,
    amountCents: input.amountCents,
    durationHours: input.durationHours,
    startedAt: now,
    expiresAt: now + input.durationHours * 60 * 60 * 1000,
  };
  s.featured.set(input.spot, claim);
  const listing = s.listings.get(input.listingId);
  if (listing) listing.totalPaid += input.amountCents;
  s.revenueCents += input.amountCents;
  return claim;
}

export function bumpPermanentBoard(listingId: string, amountCents: number) {
  const s = store();
  const listing = s.listings.get(listingId);
  if (listing) listing.totalPaid += amountCents;
  s.revenueCents += amountCents;
}

export function getRevenueCents(): number {
  return store().revenueCents;
}

// --- Settings -------------------------------------------------------------

export function getSettings(): AdminSettings {
  return store().settings;
}

export function updateSettings(partial: Partial<AdminSettings>): AdminSettings {
  const s = store();
  s.settings = { ...s.settings, ...partial };
  return s.settings;
}
