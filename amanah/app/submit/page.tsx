"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BOOST_TIERS,
  PERMANENT_PRICES_CENTS,
  formatUsd,
  isRank,
} from "@/lib/pricing";
import { BoardPayload, Purchase, Rank } from "@/lib/types";

function SubmitForm() {
  const params = useSearchParams();

  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/board", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: BoardPayload) => {
        setBoard(data);
        // Pre-select from ?type=permanent&rank=N or ?type=boost.
        const type = params.get("type");
        const rank = Number(params.get("rank"));
        if (type === "permanent" && isRank(rank)) {
          const entry = data.permanent.find((p) => p.rank === rank);
          if (entry && !entry.slot && !entry.held) setPurchase({ type: "permanent", rank });
        } else if (type === "boost") {
          setPurchase({ type: "boost", hours: BOOST_TIERS[2].hours });
        }
      })
      .catch(() => setError("Couldn't load the board. Refresh to try again."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRanks: Rank[] = useMemo(
    () => (board ? board.permanent.filter((p) => !p.slot && !p.held).map((p) => p.rank) : []),
    [board]
  );

  const price = useMemo(() => {
    if (!purchase) return null;
    if (purchase.type === "permanent") return PERMANENT_PRICES_CENTS[purchase.rank];
    return BOOST_TIERS.find((t) => t.hours === purchase.hours)?.cents ?? null;
  }, [purchase]);

  const cancelled = params.get("cancelled") === "1";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!purchase || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, description, purchase }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.redirect;
    } catch {
      setError("Network error — nothing was charged. Please try again.");
      setSubmitting(false);
    }
  }

  const selectorButton = (selected: boolean) =>
    `flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
      selected
        ? "border-emerald-900 bg-emerald-900 text-ivory shadow-card"
        : "border-emerald-900/15 bg-white/60 text-ink hover:border-emerald-900/40"
    }`;

  return (
    <main className="mx-auto max-w-3xl px-6">
      <section className="py-14 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-600">✦ List your tool ✦</p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-emerald-900 md:text-5xl">
          Three fields, one fixed price.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink/65">
          Tell us about your tool, pick a placement, pay the posted price. That's the whole
          mechanic.
        </p>
      </section>

      {cancelled && (
        <p className="mb-6 rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-sm text-gold-600">
          Checkout was cancelled — nothing was charged. Your details are still below.
        </p>
      )}

      <form onSubmit={onSubmit} className="card space-y-8 p-8">
        <fieldset className="space-y-4">
          <legend className="font-display text-xl font-semibold text-emerald-900">
            1 · Your tool
          </legend>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink/70">Tool name</span>
            <input
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Clockwork"
              className="w-full rounded-xl border border-emerald-900/15 bg-white/70 px-4 py-2.5 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink/70">Link</span>
            <input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourtool.com"
              className="w-full rounded-xl border border-emerald-900/15 bg-white/70 px-4 py-2.5 font-mono text-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink/70">
              Description <span className="text-ink/40">({description.length}/240)</span>
            </span>
            <textarea
              required
              minLength={10}
              maxLength={240}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does your agent or automation actually do?"
              className="w-full rounded-xl border border-emerald-900/15 bg-white/70 px-4 py-2.5 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-display text-xl font-semibold text-emerald-900">
            2 · Your placement
          </legend>

          <div>
            <p className="mb-2 text-sm font-medium text-ink/70">
              Permanent rank — one-time, held forever
            </p>
            {board === null ? (
              <p className="text-sm text-ink/50">Loading availability…</p>
            ) : openRanks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-emerald-900/20 bg-parchment/60 px-4 py-3 text-sm text-ink/60">
                All five permanent ranks are claimed. Timed boosts below are always open.
              </p>
            ) : (
              <div className="grid gap-2">
                {openRanks.map((rank) => {
                  const selected = purchase?.type === "permanent" && purchase.rank === rank;
                  return (
                    <button
                      key={rank}
                      type="button"
                      onClick={() => setPurchase({ type: "permanent", rank })}
                      className={selectorButton(selected)}
                    >
                      <span className="font-medium">
                        Rank {rank} <span className={selected ? "text-ivory/60" : "text-ink/40"}>· permanent</span>
                      </span>
                      <span className="font-mono">{formatUsd(PERMANENT_PRICES_CENTS[rank])}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink/70">Timed boost — fixed duration</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {BOOST_TIERS.map((tier) => {
                const selected = purchase?.type === "boost" && purchase.hours === tier.hours;
                return (
                  <button
                    key={tier.hours}
                    type="button"
                    onClick={() => setPurchase({ type: "boost", hours: tier.hours })}
                    className={selectorButton(selected)}
                  >
                    <span className="font-medium">{tier.label}</span>
                    <span className="font-mono">{formatUsd(tier.cents)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-xl font-semibold text-emerald-900">3 · Pay</legend>
          {error && (
            <p className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!purchase || submitting}
            className="mt-4 w-full rounded-full bg-emerald-900 px-6 py-3.5 font-medium text-ivory shadow-card transition enabled:hover:bg-emerald-800 enabled:hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? "Preparing checkout…"
              : purchase && price !== null
              ? `Pay ${formatUsd(price)} — fixed price`
              : "Choose a placement above"}
          </button>
          <p className="mt-3 text-center text-xs text-ink/50">
            {board?.demoMode
              ? "Demo mode: this settles instantly and charges nothing."
              : "You'll be redirected to Stripe's secure checkout. If your placement can't be delivered, you're refunded in full."}
          </p>
        </fieldset>
      </form>
    </main>
  );
}

export default function SubmitPage() {
  return (
    <Suspense>
      <SubmitForm />
    </Suspense>
  );
}
