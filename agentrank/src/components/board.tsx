"use client";

import { ArrowUpRight, MousePointerClick, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  formatCount,
  LogoBubble,
  PlacementBadge,
  ShareOnX,
} from "@/components/board-bits";
import { PurchaseDialog } from "@/components/purchase-dialog";
import type { BoardEntry } from "@/lib/ranking";
import {
  cheapestTierItem,
  formatUsd,
  PERMANENT_ITEMS,
  TIER_CAPACITY,
  TIER_LABEL,
  TIER_ITEMS,
  tierFromCents,
  type Tier,
} from "@/lib/pricing";
import { CATEGORIES, categoryName } from "@/lib/types";
import { cn } from "@/lib/utils";

type Block = "permanent" | Tier | "free";

function blockOf(entry: BoardEntry): Block {
  if (entry.type === "open_slot") return "permanent";
  const p = entry.placement;
  if (p.kind === "permanent") return "permanent";
  if (p.kind === "boost") return p.tier;
  return "free";
}

const BLOCK_META: Record<Block, { title: string; note: string }> = {
  permanent: {
    title: "Permanent Top 5",
    note: "Fixed one-time price per rank · stays until the owner cancels",
  },
  top10: {
    title: "Top 10 · timed placements",
    note: "Fixed price for a fixed duration · ordered by who arrived first, never by amount paid",
  },
  top20: {
    title: "Top 20 · timed placements",
    note: "Fixed price for a fixed duration · first come, first served",
  },
  top50: {
    title: "Top 50 · timed placements",
    note: "Fixed price for a fixed duration · first come, first served",
  },
  free: {
    title: "Open section",
    note: "Free listings — anyone can join · ordered by real clicks",
  },
};

export function Board({
  entries,
  demoMode,
}: {
  entries: BoardEntry[];
  demoMode: boolean;
}) {
  // Derived from the rows themselves rather than a prop threaded down from
  // page.tsx: starterListings() (src/lib/starter-data.ts) namespaces every
  // bootstrap-mode id "starter-", so this needs no extra plumbing and can
  // never disagree with what actually rendered. All-or-nothing in practice
  // -- page.tsx swaps in an entirely real board or an entirely starter one,
  // never a mix -- so finding one starter row is enough to know they all are.
  const starterMode =
    !demoMode &&
    entries.some((e) => e.type === "listing" && e.listing.id.startsWith("starter-"));

  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  // The SKU whose checkout dialog is open, if any. Every buy button on the
  // board names one specific item, so a click goes straight to "paste your
  // link and pay" rather than to a page of other prices.
  const [buying, setBuying] = useState<string | null>(null);

  const boostCounts = useMemo(() => {
    const counts: Record<Tier, number> = { top10: 0, top20: 0, top50: 0 };
    for (const e of entries) {
      if (e.type === "listing" && e.placement.kind === "boost") {
        counts[e.placement.tier]++;
      }
    }
    return counts;
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (e.type === "open_slot") return category === "all" && q === "";
      if (category !== "all" && e.listing.category !== category) return false;
      if (
        q &&
        !`${e.listing.name} ${e.listing.description}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [entries, category, query]);

  const filtered = category !== "all" || query.trim() !== "";

  return (
    <section id="board" className="mx-auto max-w-6xl px-4 sm:px-6">
      {buying && (
        <PurchaseDialog sku={buying} onClose={() => setBuying(null)} />
      )}
      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {[{ slug: "all", name: "All" }, ...CATEGORIES].map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCategory(c.slug)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                category === c.slug
                  ? "border-transparent bg-accent text-accent-fg"
                  : "border-border text-muted hover:border-border-strong hover:text-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label className="relative block lg:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search listings…"
            className="w-full rounded-full border border-control-border bg-surface py-2 pr-4 pl-10 text-sm outline-none placeholder:text-faint"
          />
        </label>
      </div>

      {demoMode && (
        <p className="mb-4 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs text-muted">
          <span className="font-semibold text-foreground">Demo data.</span>{" "}
          These fictional listings render until Supabase + Stripe environment
          variables are configured — see the README.
        </p>
      )}

      {starterMode && (
        <p className="mb-4 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs text-muted">
          <span className="font-semibold text-foreground">Starter listings.</span>{" "}
          Nobody has bought or listed a spot yet, so these fill the board for
          launch. The moment a real listing exists — free or paid — these
          disappear automatically.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {visible.length === 0 && (
          <p className="px-6 py-14 text-center text-sm text-muted">
            Nothing matches that filter yet.{" "}
            <Link href="/submit" className="underline underline-offset-4">
              Be the first to list
            </Link>
            .
          </p>
        )}

        {visible.map((entry, i) => {
          const block = blockOf(entry);
          const prev = i > 0 ? blockOf(visible[i - 1]) : null;
          const showHeader = !filtered && block !== prev;

          return (
            <div key={entry.type === "listing" ? entry.listing.id : `slot-${entry.rank}`}>
              {showHeader && (
                <div
                  className={cn(
                    "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3 sm:px-6",
                    i > 0 && "border-t",
                  )}
                >
                  <h2 className="font-display text-sm font-semibold tracking-wide">
                    {BLOCK_META[block].title}
                  </h2>
                  <p className="text-xs text-faint">{BLOCK_META[block].note}</p>
                </div>
              )}
              {showHeader &&
                block !== "permanent" &&
                block !== "free" &&
                boostCounts[block] < TIER_CAPACITY[block] && (
                  <Link
                    href="/pricing"
                    className="flex items-center justify-between gap-3 border-b border-dashed border-border px-4 py-2.5 text-xs text-muted transition-colors hover:bg-raised sm:px-6"
                  >
                    <span>
                      {TIER_CAPACITY[block] - boostCounts[block]} of{" "}
                      {TIER_CAPACITY[block]} {TIER_LABEL[block]} slots open — fixed
                      prices from{" "}
                      {formatUsd(
                        Math.min(...TIER_ITEMS(block).map((t) => t.amountCents)),
                      )}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                )}
              {entry.type === "open_slot" ? (
                <OpenSlotRow
                  rank={entry.rank}
                  priceCents={entry.priceCents}
                  permanentRank={entry.permanentRank}
                  available={entry.available}
                  onBuy={setBuying}
                />
              ) : (
                <ListingRow entry={entry} index={i} onBuy={setBuying} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OpenSlotRow({
  rank,
  permanentRank,
  priceCents,
  available,
  onBuy,
}: {
  rank: number;
  permanentRank: number;
  priceCents: number;
  available: boolean;
  onBuy: (sku: string) => void;
}) {
  // The rent entry price for the tier immediately below the permanent block.
  // Leading with it is the point of this row: a visitor who is shown $4,500
  // first has already decided the board is not for them by the time they find
  // out a spot can be had for a fraction of that. Owning the rank outright is
  // still here, just second.
  const rentItem = cheapestTierItem("top10");
  // The permanent SKU for this exact rank, so "Own" buys #1 (or #5) directly
  // rather than handing over a list of five to choose from again.
  const ownItem = PERMANENT_ITEMS.find((i) => i.rank === permanentRank);

  // Stacked until sm, like ListingRow: side by side, the fixed rank column,
  // bubble and price pills leave the title about 40px on a 360px screen, which
  // wraps "Rank #1 is available" one word per line.
  const shell =
    "flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 sm:px-6";

  return (
    <div className={cn(shell, !available && "opacity-60")}>
      <span className="flex min-w-0 flex-1 items-center gap-4">
        <span className="w-9 shrink-0 text-center font-display text-lg font-semibold text-faint tabular-nums">
          {rank}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-border-strong text-faint">
          —
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-muted">
            {available ? `Rank #${permanentRank} is available` : `Rank #${permanentRank} — unavailable`}
          </span>
          <span className="block text-xs text-faint">
            {available
              ? // Deliberately explicit that renting buys a Top 10 spot, not
                // this rank: the cheap price is the hook, but it must never
                // read as "rank #1 for $129".
                `Rent a ${TIER_LABEL.top10} spot for ${rentItem.durationHours}h — or own #${permanentRank} outright`
              : "Held by a listing pending review — not purchasable right now"}
          </span>
        </span>
      </span>
      {available && (
        // pl-13 clears the rank column + gap so the pills line up under the
        // dashed bubble once the row has stacked, the same offset ListingRow
        // uses for its Visit/Share group.
        //
        // Both open the checkout dialog for one specific SKU instead of
        // linking to /pricing. Sending someone who clicked a price to a page
        // listing six other prices is the step that lost them; from here it is
        // paste your link, pay, done.
        <span className="flex shrink-0 flex-wrap items-center gap-2 pl-13 sm:pl-0">
          <button
            type="button"
            onClick={() => onBuy(rentItem.sku)}
            className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-fg transition-opacity hover:opacity-90"
          >
            Rent now · {formatUsd(rentItem.amountCents)}
          </button>
          {ownItem && (
            <button
              type="button"
              onClick={() => onBuy(ownItem.sku)}
              className="rounded-full border border-gold/40 bg-gold-soft px-3 py-1.5 text-xs font-semibold text-gold transition-colors hover:border-gold/70"
            >
              Own · {formatUsd(priceCents)}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

function ListingRow({
  entry,
  index,
  onBuy,
}: {
  entry: Extract<BoardEntry, { type: "listing" }>;
  index: number;
  onBuy: (sku: string) => void;
}) {
  const { listing, placement, highlighted, rank } = entry;
  return (
    <article
      className={cn(
        "row-in relative flex flex-col gap-3 border-b border-border px-4 py-4 transition-colors last:border-b-0 sm:flex-row sm:items-center sm:gap-4 sm:px-6",
        placement.kind === "permanent" && "bg-gold-soft/50",
        // A paid Highlight / Pin: gold tint plus a light-gold shimmer that
        // travels around the row (see .highlight-orbit in globals.css).
        highlighted && "highlight-orbit bg-gold-soft",
        // Hover must not paint over a tint someone paid for, so a tinted row
        // deepens its own gold instead of swapping to the neutral raised fill.
        placement.kind === "permanent" || highlighted
          ? "hover:bg-gold-soft"
          : "hover:bg-raised",
      )}
      style={{ animationDelay: `${Math.min(index, 20) * 35}ms` }}
    >
      {placement.kind === "permanent" && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-0.5 bg-gold"
        />
      )}
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span
          className={cn(
            "w-9 shrink-0 text-center font-display text-lg font-semibold tabular-nums",
            placement.kind === "permanent" ? "text-gold" : "text-muted",
          )}
        >
          {rank}
        </span>
        <LogoBubble name={listing.name} logoUrl={listing.logoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <a
              href={`/go/${listing.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[15px] font-semibold hover:underline underline-offset-4"
            >
              {listing.name}
            </a>
            <PlacementBadge placement={placement} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted">
            {listing.description}
          </p>
          <p className="mt-1 flex items-center gap-3 text-xs text-muted">
            <span>{categoryName(listing.category)}</span>
            <span
              className="inline-flex items-center gap-1"
              title="Real outbound clicks"
            >
              <MousePointerClick className="h-3.5 w-3.5" />
              {formatCount(listing.clickCount)}
            </span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-13 sm:pl-0">
        {/* An expired boost means that tier has a slot free again. The button
            sells the freed slot rather than renewing this listing — a buyer
            supplies their own URL in the dialog. It names the tier's entry
            rung outright instead of a "from" price behind another page, so
            the number on the button is the number they pay. */}
        {placement.kind === "free" && placement.lapsedTier && (
          <button
            type="button"
            onClick={() => onBuy(cheapestTierItem(placement.lapsedTier!).sku)}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft px-3.5 py-1.5 text-[13px] font-semibold text-gold transition-colors hover:border-gold/70"
          >
            Rent {TIER_LABEL[placement.lapsedTier]} ·{" "}
            {formatUsd(tierFromCents(placement.lapsedTier))}
          </button>
        )}
        <ShareOnX name={listing.name} rank={rank} />
        <a
          href={`/go/${listing.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-[13px] font-medium transition-colors hover:border-border-strong hover:bg-raised"
        >
          Visit
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}
