"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import FeaturedGrid, { FeaturedEntry } from "@/components/FeaturedGrid";
import Leaderboard from "@/components/Leaderboard";
import HowItWorks from "@/components/HowItWorks";
import ShareButtons from "@/components/ShareButtons";
import { Listing, Duration } from "@/lib/types";

type ListingsResponse = {
  featured: FeaturedEntry[];
  leaderboard: Listing[];
  revenueCents: number;
  settings: { maxDurationHours: Duration };
};

const ALL_DURATIONS: Duration[] = [6, 12, 24, 72];

export default function Home() {
  const [data, setData] = useState<ListingsResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/listings", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch {
      // silent — next poll will retry
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const registerClick = useCallback((listingId: string) => {
    fetch(`/api/listings/${listingId}`, { method: "POST" }).catch(() => {});
  }, []);

  const durations = data
    ? ALL_DURATIONS.filter((d) => d <= data.settings.maxDurationHours)
    : ALL_DURATIONS;

  return (
    <main className="min-h-screen">
      <Header revenueCents={data?.revenueCents ?? 0} />

      {/* Left-aligned editorial hero. Centered hero + gradient headline is the
          exact shape every generated landing page takes; this doesn't. */}
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-faint">
          Five spots · Timed reigns · No accounts
        </p>
        <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[0.95] tracking-tightest sm:text-7xl">
          Pay to be seen.
          <br />
          <span className="italic text-ink-mute">Nobody stays</span> forever.
        </h1>
        <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-mute">
          Rent one of five spots at the top of the page. Anyone can take yours
          early by paying out what's left on your clock, plus a premium. Below
          that, a board where the money never expires.
        </p>
        <div className="mt-7">
          <ShareButtons text="Someone just paid real money to sit at the top of SuperSpot 👀" />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <p className="rule-label mb-4">Featured now</p>
        {data ? (
          <FeaturedGrid
            entries={data.featured}
            durations={durations}
            onRefresh={refresh}
            onClick={registerClick}
          />
        ) : (
          <FeaturedSkeleton />
        )}
      </section>

      <section className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
        {data ? (
          <Leaderboard
            listings={data.leaderboard}
            onRefresh={refresh}
            onClick={registerClick}
          />
        ) : (
          <div className="surface h-72 animate-pulse rounded-lg" />
        )}
      </section>

      <section className="mx-auto mt-20 max-w-5xl px-4 sm:px-6">
        <HowItWorks />
      </section>

      <footer className="mx-auto mt-20 max-w-5xl border-t border-line px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="num text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            SuperSpot · a demo
          </p>
          <p className="max-w-md text-xs text-ink-faint">
            No NSFW, no invite-link spam, no adult content — violators get
            de-listed.{" "}
            <a href="/admin" className="underline underline-offset-2 hover:text-ink">
              Admin
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="surface h-64 animate-pulse rounded-lg lg:col-span-2" />
      <div className="grid gap-3">
        <div className="surface h-[7.5rem] animate-pulse rounded-lg" />
        <div className="surface h-[7.5rem] animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
