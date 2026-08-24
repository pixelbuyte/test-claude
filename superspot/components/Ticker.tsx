"use client";

import { Listing } from "@/lib/types";

/** Scrolling activity strip under the header — the thing that makes the
 *  board feel alive and contested rather than static. Duplicated once so
 *  the -50% keyframe loops seamlessly. */
export default function Ticker({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) return null;

  const items = listings.slice(0, 8).map((l) => ({
    name: l.title,
    amount: (l.totalPaid / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }),
  }));

  return (
    <div className="relative z-[2] overflow-hidden border-b border-edge bg-panel py-2">
      <div className="marquee">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
            {items.map((it, i) => (
              <span
                key={`${copy}-${i}`}
                className="num flex items-center gap-2 whitespace-nowrap px-5 text-[11px] uppercase tracking-[0.14em]"
              >
                <span className="text-dust">{it.name}</span>
                <span className="text-acid">{it.amount}</span>
                <span className="text-edge-hot">/</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
