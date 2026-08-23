"use client";

import { useState } from "react";
import { Listing } from "@/lib/types";
import ClaimModal from "./ClaimModal";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function Leaderboard({
  listings,
  onRefresh,
  onClick,
}: {
  listings: Listing[];
  onRefresh: () => void;
  onClick: (listingId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass rounded-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Permanent leaderboard</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Classic Outbid rules — highest total bid wins the rank. Never expires.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          + Place a bid
        </button>
      </div>

      {listings.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-3xl">🏆</span>
          <p className="font-medium">No bids yet</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Be the first name on the board.</p>
        </div>
      ) : (
        <ol className="mt-4 divide-y divide-black/5 dark:divide-white/5">
          {listings.map((l, i) => (
            <li key={l.id}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => onClick(l.id)}
                className="flex items-center gap-3 py-3 group"
              >
                <span className="w-7 shrink-0 text-center text-sm font-bold text-neutral-400">
                  {MEDAL[i] ?? i + 1}
                </span>
                {l.favicon && <img src={l.favicon} alt="" className="h-8 w-8 rounded-md" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold group-hover:text-brand-500 transition">{l.title}</p>
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{l.url.replace(/^https?:\/\//, "")}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">{money(l.totalPaid)}</p>
                  <p className="text-[11px] text-neutral-400 tabular-nums">{l.clicks.toLocaleString()} clicks</p>
                </div>
              </a>
            </li>
          ))}
        </ol>
      )}

      <ClaimModal open={open} onClose={() => setOpen(false)} onDone={onRefresh} mode="permanent" durations={[]} />
    </div>
  );
}
