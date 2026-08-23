"use client";

import { useState } from "react";
import { Listing } from "@/lib/types";
import ClaimModal from "./ClaimModal";
import SiteIcon from "./SiteIcon";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

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
  const top = listings[0]?.totalPaid ?? 0;

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
            The permanent board
          </h2>
          <p className="mt-1 max-w-md text-sm text-ink-mute">
            Highest total bid ranks highest. No timer, no expiry — the only way
            down is someone else paying more.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="num shrink-0 rounded-md border border-line-strong px-3 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors hover:border-cash hover:text-cash"
        >
          Place a bid
        </button>
      </div>

      {listings.length === 0 ? (
        <div className="surface rounded-lg py-16 text-center">
          <p className="font-display text-2xl italic text-ink-faint">
            No names on the board yet
          </p>
          <p className="mt-2 text-sm text-ink-mute">Be the first.</p>
        </div>
      ) : (
        <ol className="surface overflow-hidden rounded-lg">
          {listings.map((l, i) => (
            <li key={l.id} className={i > 0 ? "border-t border-line" : ""}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => onClick(l.id)}
                className="group relative flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
              >
                {/* Bid share as a hairline bar behind the row — the ranking
                    becomes legible at a glance without a chart. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: top ? `${(l.totalPaid / top) * 100}%` : 0,
                    background:
                      "linear-gradient(90deg, rgba(18,196,99,0.09), rgba(18,196,99,0))",
                  }}
                />

                <span
                  className={`num relative w-8 shrink-0 text-right text-sm ${
                    i === 0 ? "text-gold" : "text-ink-faint"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <SiteIcon src={l.favicon} title={l.title} className="relative h-7 w-7 text-xs" />

                <div className="relative min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight transition-colors group-hover:text-cash">
                    {l.title}
                  </p>
                  <p className="num truncate text-[11px] text-ink-faint">
                    {l.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </p>
                </div>

                <div className="relative shrink-0 text-right">
                  <p className="num text-sm font-semibold">{money(l.totalPaid)}</p>
                  <p className="num text-[11px] text-ink-faint">
                    {l.clicks.toLocaleString()} clicks
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ol>
      )}

      <ClaimModal
        open={open}
        onClose={() => setOpen(false)}
        onDone={onRefresh}
        mode="permanent"
        durations={[]}
      />
    </div>
  );
}
