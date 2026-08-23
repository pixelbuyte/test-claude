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

  const durations = data ? ALL_DURATIONS.filter((d) => d <= data.settings.maxDurationHours) : ALL_DURATIONS;

  return (
    <main className="min-h-screen">
      <Header revenueCents={data?.revenueCents ?? 0} />

      <section className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
        <div className="text-center">
          <h1 className="shimmer-text text-4xl font-black tracking-tight sm:text-5xl">
            Pay to be seen. Timed, not forever.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-neutral-500 dark:text-neutral-400">
            5 featured spots up top. Steal them early if you dare. A permanent leaderboard below for the long game.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 sm:hidden">
            <span className="text-sm text-neutral-500">
              {((data?.revenueCents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}{" "}
              paid out
            </span>
          </div>
          <div className="mt-6 flex justify-center">
            <ShareButtons text="I just watched someone pay real money for a spot on SuperSpot 👀" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        {data ? (
          <FeaturedGrid entries={data.featured} durations={durations} onRefresh={refresh} onClick={registerClick} />
        ) : (
          <FeaturedSkeleton />
        )}
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        {data ? (
          <Leaderboard listings={data.leaderboard} onRefresh={refresh} onClick={registerClick} />
        ) : (
          <div className="glass h-64 animate-pulse rounded-2xl" />
        )}
      </section>

      <section className="mx-auto my-10 max-w-6xl px-4 sm:px-6">
        <HowItWorks />
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-center text-xs text-neutral-400 sm:px-6">
        SuperSpot is a demo project. No NSFW, no invite-link spam, no adult content — violators get de-listed.{" "}
        <a href="/admin" className="underline hover:text-brand-500">
          Admin
        </a>
      </footer>
    </main>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="glass h-44 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}
