"use client";

import { useEffect, useState } from "react";

import { formatCount } from "@/components/board-bits";
import { formatUsd } from "@/lib/pricing";

function anonId(): string {
  try {
    const key = "agentrank_anon";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Heartbeats presence and polls the live visitor count. */
function useLiveVisitors(initial: number): number {
  const [count, setCount] = useState(initial);
  useEffect(() => {
    let cancelled = false;
    const beat = async () => {
      try {
        const id = anonId();
        if (id) {
          await fetch("/api/presence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ anonId: id }),
          });
        }
        const res = await fetch("/api/presence");
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled && typeof data.count === "number" && data.count > 0) {
          setCount(data.count);
        }
      } catch {
        // best-effort
      }
    };
    beat();
    const id = setInterval(beat, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return count;
}

export function StatsBar({
  totalListings,
  totalClicks,
  liveVisitors,
  totalRevenueCents,
}: {
  totalListings: number;
  totalClicks: number;
  liveVisitors: number;
  totalRevenueCents: number | null;
}) {
  const live = useLiveVisitors(liveVisitors);

  const cells: { label: string; value: React.ReactNode }[] = [
    {
      label: "Live right now",
      value: (
        <span className="inline-flex items-center gap-2">
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-success" />
          {formatCount(live)}
        </span>
      ),
    },
    { label: "Listings ranked", value: formatCount(totalListings) },
    { label: "Outbound clicks", value: formatCount(totalClicks) },
  ];
  if (totalRevenueCents !== null) {
    cells.push({
      label: "Placements sold",
      value: formatUsd(totalRevenueCents),
    });
  }

  return (
    <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-surface px-5 py-4">
          <dt className="text-xs tracking-wide text-faint uppercase">
            {cell.label}
          </dt>
          <dd className="mt-1 font-display text-xl font-semibold tabular-nums">
            {cell.value}
          </dd>
        </div>
      ))}
      {totalRevenueCents === null && (
        <div className="hidden bg-surface px-5 py-4 sm:block">
          <dt className="text-xs tracking-wide text-faint uppercase">Model</dt>
          <dd className="mt-1 font-display text-xl font-semibold">
            Fixed prices
          </dd>
        </div>
      )}
    </dl>
  );
}
