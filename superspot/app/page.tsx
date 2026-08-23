"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import Ticker from "@/components/Ticker";
import FeaturedGrid, { FeaturedEntry } from "@/components/FeaturedGrid";
import Leaderboard from "@/components/Leaderboard";
import HowItWorks from "@/components/HowItWorks";
import MoneyRules from "@/components/MoneyRules";
import ShareButtons from "@/components/ShareButtons";
import { Listing, Duration } from "@/lib/types";

type ListingsResponse = {
  featured: FeaturedEntry[];
  leaderboard: Listing[];
  revenueCents: number;
  settings: { maxDurationHours: Duration };
  payments: { enabled: boolean; live: boolean; minAmountCents: number };
};

const ALL_DURATIONS: Duration[] = [6, 12, 24, 72];

export default function Home() {
  const [data, setData] = useState<ListingsResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/listings", { cache: "no-store" });
      setData(await res.json());
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

  const openCount = data?.featured.filter((f) => !f.claim).length ?? 0;

  return (
    <>
      <Header revenueCents={data?.revenueCents ?? 0} />
      <Ticker listings={data?.leaderboard ?? []} />

      <main className="min-h-screen">
        {/* Hero: one enormous condensed statement. The type IS the graphic —
            no illustration, no gradient blob, no centered paragraph. */}
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
          <p className="deal num text-[11px] uppercase tracking-[0.22em] text-acid">
            {openCount > 0
              ? `${openCount} of 5 spots open right now`
              : "All 5 spots taken — steal one"}
          </p>

          <h1
            className="deal mt-6 font-display text-[3.5rem] uppercase leading-[0.82] tracking-crush sm:text-[7rem] lg:text-[8.5rem]"
            style={{ animationDelay: "60ms" }}
          >
            Pay to sit
            <br />
            at the
            <span className="ghost-rank ml-5 inline-block align-baseline sm:ml-8">top</span>
          </h1>

          <div
            className="deal mt-8 flex flex-wrap items-end justify-between gap-6"
            style={{ animationDelay: "140ms" }}
          >
            <p className="max-w-md text-[15px] leading-relaxed text-ash">
              Five spots. Rent one for 6 hours or 3 days. Anyone can rip it out
              from under you by covering what&apos;s left on your clock plus a
              premium. Below that sits a permanent board that never expires and
              never gets stolen.
            </p>
            <ShareButtons text="Someone just paid real money to sit at the top of SuperSpot 👀" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="rule-label mb-5">Live spots</p>
          {data ? (
            <FeaturedGrid
              entries={data.featured}
              durations={durations}
              payments={data.payments}
              onRefresh={refresh}
              onClick={registerClick}
            />
          ) : (
            <Skeleton />
          )}
        </section>

        <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
          <p className="rule-label mb-5">Permanent — never expires</p>
          {data ? (
            <Leaderboard
              listings={data.leaderboard}
              payments={data.payments}
              onRefresh={refresh}
              onClick={registerClick}
            />
          ) : (
            <div className="panel h-80 animate-pulse" />
          )}
        </section>

        <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <MoneyRules totalCents={data?.revenueCents ?? 0} />
        </section>

        <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
          <HowItWorks />
        </section>

        <footer className="mx-auto mt-24 max-w-6xl border-t border-edge px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-2xl uppercase tracking-crush text-dust">
              SuperSpot
            </span>
            <p className="max-w-md text-xs text-dust">
              No NSFW, no invite-link spam, no adult content — violators get
              de-listed without a refund.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="panel h-80 animate-pulse lg:col-span-2" />
      <div className="grid gap-4">
        <div className="panel h-[9.5rem] animate-pulse" />
        <div className="panel h-[9.5rem] animate-pulse" />
      </div>
    </div>
  );
}
