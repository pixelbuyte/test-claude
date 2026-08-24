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
import type { BoardEntry } from "@/lib/ranking";
import { formatUsd, TIER_CAPACITY, TIER_LABEL, TIER_ITEMS, type Tier } from "@/lib/pricing";
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
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

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
            className="w-full rounded-full border border-border bg-surface py-2 pr-4 pl-10 text-sm outline-none placeholder:text-faint focus:border-border-strong"
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
                />
              ) : (
                <ListingRow entry={entry} index={i} />
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
}: {
  rank: number;
  permanentRank: number;
  priceCents: number;
  available: boolean;
}) {
  const content = (
    <>
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
            ? "Own this position permanently — fixed one-time price"
            : "Held by a listing pending review — not purchasable right now"}
        </span>
      </span>
      {available && (
        <span className="shrink-0 rounded-full border border-gold/40 bg-gold-soft px-3 py-1.5 text-xs font-semibold text-gold">
          Claim · {formatUsd(priceCents)}
        </span>
      )}
    </>
  );

  if (!available) {
    return (
      <div className="flex items-center gap-4 border-b border-border px-4 py-4 opacity-60 last:border-b-0 sm:px-6">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/pricing#permanent`}
      className="group flex items-center gap-4 border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-raised sm:px-6"
    >
      {content}
    </Link>
  );
}

function ListingRow({
  entry,
  index,
}: {
  entry: Extract<BoardEntry, { type: "listing" }>;
  index: number;
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
        "hover:bg-raised",
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
          <p className="mt-1 flex items-center gap-3 text-xs text-faint">
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
      <div className="flex shrink-0 items-center gap-2 pl-13 sm:pl-0">
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
