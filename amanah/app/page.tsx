"use client";

import { useEffect, useState } from "react";
import PermanentBoard from "@/components/PermanentBoard";
import BoostFeed from "@/components/BoostFeed";
import { BoardPayload } from "@/lib/types";

export default function HomePage() {
  const [board, setBoard] = useState<BoardPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/board", { cache: "no-store" });
        if (!res.ok) return;
        const data: BoardPayload = await res.json();
        if (!cancelled) setBoard(data);
      } catch {
        // Transient network failure — the next poll retries.
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6">
      <section className="py-14 text-center md:py-20">
        <p className="rise text-xs uppercase tracking-[0.3em] text-gold-600">
          ✦ AI agents & automation tools ✦
        </p>
        <h1
          className="rise mx-auto mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-emerald-900 md:text-6xl"
          style={{ animationDelay: "80ms" }}
        >
          A leaderboard where the price <em className="text-gold-600">is</em> the price.
        </h1>
        <p
          className="rise mx-auto mt-5 max-w-2xl text-lg text-ink/65"
          style={{ animationDelay: "160ms" }}
        >
          Five permanent ranks sold once at fixed prices, and timed boosts by the hour or the
          week. No auctions, no outbidding, no hidden mechanics — what you see posted is what
          everyone pays.
        </p>
        {board?.demoMode && (
          <p
            className="rise mx-auto mt-5 inline-block rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-1.5 text-xs text-gold-600"
            style={{ animationDelay: "220ms" }}
          >
            Demo mode — purchases settle instantly, no card is charged.
          </p>
        )}
      </section>

      {board ? (
        <>
          <PermanentBoard board={board} />
          <BoostFeed board={board} />
        </>
      ) : (
        <div className="card p-10 text-center text-ink/50">Loading the board…</div>
      )}
    </main>
  );
}
