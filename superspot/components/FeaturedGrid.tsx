"use client";

import { useState } from "react";
import { Listing, FeaturedClaim, Duration } from "@/lib/types";
import CountdownTimer from "./CountdownTimer";
import ClaimModal from "./ClaimModal";

export type FeaturedEntry = {
  spot: number;
  claim: FeaturedClaim | null;
  listing: Listing | null;
  openPriceCents: number;
  stealPriceCents: number | null;
};

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const SPOT_STYLES: Record<number, string> = {
  1: "from-gold/25 via-gold/[0.06] to-transparent ring-gold/40",
  2: "from-slate-300/20 via-slate-200/[0.06] to-transparent ring-slate-300/25",
  3: "from-orange-400/20 via-orange-300/[0.06] to-transparent ring-orange-400/25",
  4: "from-brand-500/15 via-brand-400/[0.06] to-transparent ring-brand-500/20",
  5: "from-brand-500/10 via-brand-400/[0.04] to-transparent ring-brand-500/15",
};

export default function FeaturedGrid({
  entries,
  durations,
  onRefresh,
  onClick,
}: {
  entries: FeaturedEntry[];
  durations: Duration[];
  onRefresh: () => void;
  onClick: (listingId: string) => void;
}) {
  const [modalSpot, setModalSpot] = useState<FeaturedEntry | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {entries.map((entry) => {
          const occupied = !!entry.claim && !!entry.listing;
          return (
            <div
              key={entry.spot}
              className={`relative overflow-hidden rounded-2xl ring-1 bg-gradient-to-br p-4 glass ${SPOT_STYLES[entry.spot]}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Spot #{entry.spot}
                </span>
                {occupied ? (
                  <CountdownTimer expiresAt={entry.claim!.expiresAt} onExpire={onRefresh} className="text-[11px]" />
                ) : (
                  <span className="text-[11px] font-medium text-emerald-500">Open</span>
                )}
              </div>

              {occupied ? (
                <a
                  href={entry.listing!.url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={() => onClick(entry.listing!.id)}
                  className="mt-3 flex items-center gap-3 group"
                >
                  {entry.listing!.favicon && (
                    <img src={entry.listing!.favicon} alt="" className="h-10 w-10 rounded-lg" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold group-hover:text-brand-500 transition">
                      {entry.listing!.title}
                    </p>
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {entry.listing!.description || entry.listing!.url}
                    </p>
                  </div>
                </a>
              ) : (
                <div className="mt-3 flex h-10 items-center gap-3">
                  <div className="h-10 w-10 rounded-lg border border-dashed border-black/15 dark:border-white/15" />
                  <p className="text-sm text-neutral-400">Nobody's here yet</p>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>{occupied ? `${entry.listing!.clicks.toLocaleString()} clicks` : "Be the first"}</span>
                <button
                  onClick={() => setModalSpot(entry)}
                  className="rounded-full bg-brand-500 text-black px-3 py-1 text-[11px] font-bold hover:bg-brand-400 transition"
                >
                  {occupied ? `Steal ${money(entry.stealPriceCents ?? entry.openPriceCents)}` : `Claim ${money(entry.openPriceCents)}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ClaimModal
        open={!!modalSpot}
        onClose={() => setModalSpot(null)}
        onDone={onRefresh}
        mode="featured"
        spot={modalSpot?.spot}
        openPriceCents={modalSpot?.openPriceCents}
        stealPriceCents={modalSpot?.stealPriceCents}
        durations={durations}
      />
    </>
  );
}
