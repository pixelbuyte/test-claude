"use client";

import { useState } from "react";
import { Listing } from "@/lib/types";
import ClaimModal from "./ClaimModal";
import Reveal from "./Reveal";
import SiteIcon from "./SiteIcon";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function Leaderboard({
  listings,
  onRefresh,
  onClick,
  payments,
}: {
  listings: Listing[];
  onRefresh: () => void;
  onClick: (listingId: string) => void;
  payments?: { enabled: boolean; live: boolean; minAmountCents: number };
}) {
  const [open, setOpen] = useState(false);
  const top = listings[0]?.totalPaid ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl uppercase leading-[0.9] tracking-crush sm:text-5xl">
            All-time board
          </h2>
          <p className="mt-2 max-w-md text-sm text-ash">
            No clock here. Highest total paid sits highest — the only way down
            is somebody spending more than you.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="num press border border-acid bg-acid px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#07070a] hover:shadow-[4px_4px_0_0_var(--edge-hot)]"
        >
          Put money down
        </button>
      </div>

      {listings.length === 0 ? (
        <div className="panel py-20 text-center">
          <p className="font-display text-3xl uppercase tracking-crush text-dust">
            Board&apos;s empty
          </p>
          <p className="mt-2 text-sm text-ash">Somebody has to go first.</p>
        </div>
      ) : (
        <ol className="panel divide-y divide-edge">
          {listings.map((l, i) => (
            <Reveal
              as="li"
              key={l.id}
              delay={Math.min(i, 8) * 45}
              className="relative overflow-hidden"
            >
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => onClick(l.id)}
                className="group sweep relative flex items-center gap-4 px-4 py-4 transition-colors hover:bg-panel-2 sm:px-5"
              >
                {/* Share-of-pot bar: the row itself is the chart. It grows
                    from zero as the row scrolls in, so the ranking reads as
                    a result being tallied rather than a static table. */}
                <span
                  aria-hidden
                  className="bar absolute inset-y-0 left-0 transition-opacity group-hover:opacity-80"
                  style={{
                    width: top ? `${(l.totalPaid / top) * 100}%` : 0,
                    transitionDelay: `${Math.min(i, 8) * 45 + 120}ms`,
                    background:
                      i === 0
                        ? "linear-gradient(90deg, rgba(204,255,0,0.16), transparent)"
                        : "linear-gradient(90deg, rgba(204,255,0,0.07), transparent)",
                  }}
                />

                <span
                  className={`relative w-10 shrink-0 font-display text-3xl leading-none tracking-crush ${
                    i === 0 ? "text-acid" : i < 3 ? "text-bone" : "text-dust"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <SiteIcon src={l.favicon} title={l.title} className="relative h-9 w-9" />

                <div className="relative min-w-0 flex-1">
                  <p className="truncate font-display text-lg uppercase leading-none tracking-crush transition-colors group-hover:text-acid">
                    {l.title}
                  </p>
                  <p className="num truncate text-[11px] text-dust">
                    {l.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </p>
                </div>

                <div className="relative shrink-0 text-right">
                  <p className="font-display text-xl leading-none tracking-crush text-acid">
                    {money(l.totalPaid)}
                  </p>
                  <p className="num mt-1 text-[11px] text-dust">
                    {l.clicks.toLocaleString()} clicks
                  </p>
                </div>
              </a>
            </Reveal>
          ))}
        </ol>
      )}

      <ClaimModal
        open={open}
        onClose={() => setOpen(false)}
        onDone={onRefresh}
        mode="permanent"
        durations={[]}
        payments={payments}
      />
    </div>
  );
}
