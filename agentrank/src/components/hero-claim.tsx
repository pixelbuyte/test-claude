"use client";

import { ArrowRight, Crown, Globe, Loader2, Timer } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import {
  formatUsd,
  PERMANENT_ITEMS,
  TIER_ITEMS,
  TIER_LABEL,
  type Tier,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Mode = "permanent" | "rent";

/**
 * The hero's buy widget. Leads with the best permanent rank still available
 * ("Claim #1 for $4,500"), with a toggle across to renting a timed spot
 * instead. Both paths post the same {sku, url} to /api/checkout, so a buyer
 * only ever supplies a URL.
 */
export function HeroClaim({ takenRanks }: { takenRanks: number[] }) {
  const [mode, setMode] = useState<Mode>("permanent");
  const [tier, setTier] = useState<Tier>("top10");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const availablePermanent = useMemo(
    () => PERMANENT_ITEMS.filter((i) => !takenRanks.includes(i.rank!)),
    [takenRanks],
  );
  const [permanentSku, setPermanentSku] = useState<string | null>(
    availablePermanent[0]?.sku ?? null,
  );
  const [rentSku, setRentSku] = useState<string>(TIER_ITEMS("top10")[2].sku);

  const permanentChoice =
    availablePermanent.find((i) => i.sku === permanentSku) ??
    availablePermanent[0];
  const rentChoice =
    TIER_ITEMS(tier).find((i) => i.sku === rentSku) ?? TIER_ITEMS(tier)[0];
  const active = mode === "permanent" ? permanentChoice : rentChoice;

  const selectTier = (t: Tier) => {
    setTier(t);
    setRentSku(TIER_ITEMS(t)[Math.min(2, TIER_ITEMS(t).length - 1)].sku);
  };

  const go = async () => {
    if (!active) return;
    // The button stays live even with an empty field: a greyed-out button
    // that also hides the price reads as broken, and pointing at the one
    // field we need is a shorter path than making people work out why.
    if (url.trim().length < 4) {
      setError("Paste your link first — that's all we need.");
      urlRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: active.sku, url }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  };

  const chip = (selected: boolean) =>
    cn(
      "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
      selected
        ? "border-transparent bg-accent text-accent-fg"
        : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
    );

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7">
      {/* Permanent vs rent */}
      <div className="inline-flex rounded-full border border-border bg-raised p-1">
        {(
          [
            { key: "permanent", label: "Own it permanently", icon: Crown },
            { key: "rent", label: "Rent for a set time", icon: Timer },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            aria-pressed={mode === key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              mode === key
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {mode === "permanent" ? (
        availablePermanent.length > 0 ? (
          <>
            <p className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Claim{" "}
              <span className="text-gold">#{permanentChoice?.rank}</span> for{" "}
              <span className="text-accent-strong">
                {formatUsd(permanentChoice?.amountCents ?? 0)}
              </span>
            </p>
            <p className="mt-2 text-sm text-muted">
              One fixed payment. The spot is yours until you cancel — nobody can
              outbid you for it, at any price.
            </p>
            {availablePermanent.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {availablePermanent.map((i) => (
                  <button
                    key={i.sku}
                    type="button"
                    onClick={() => setPermanentSku(i.sku)}
                    className={chip(permanentChoice?.sku === i.sku)}
                  >
                    #{i.rank} · {formatUsd(i.amountCents)}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-5 text-sm text-muted">
            All five permanent ranks are currently owned.{" "}
            <button
              type="button"
              onClick={() => setMode("rent")}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Rent a timed spot instead
            </button>
            .
          </p>
        )
      ) : (
        <>
          <p className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {TIER_LABEL[tier]} for{" "}
            <span className="text-accent-strong">
              {formatUsd(rentChoice?.amountCents ?? 0)}
            </span>
          </p>
          <p className="mt-2 text-sm text-muted">
            A guaranteed place in the tier for a fixed time, then it expires on
            its own. Inside a tier it&rsquo;s first come, first served — never
            who paid most.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["top10", "top20", "top50"] as Tier[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => selectTier(t)}
                className={chip(tier === t)}
              >
                {TIER_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIER_ITEMS(tier).map((i) => (
              <button
                key={i.sku}
                type="button"
                onClick={() => setRentSku(i.sku)}
                className={chip(rentChoice?.sku === i.sku)}
              >
                {i.label.split("·")[1]?.trim()} · {formatUsd(i.amountCents)}
              </button>
            ))}
          </div>
        </>
      )}

      {/* One field: the URL */}
      <div className="mt-5">
        <label htmlFor="hero-url" className="sr-only">
          Your site URL
        </label>
        <div className="relative">
          <Globe className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            id="hero-url"
            ref={urlRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) go();
            }}
            placeholder="Your site URL or @handle"
            className="w-full rounded-2xl border border-control-border bg-background py-3.5 pr-4 pl-11 text-sm outline-none placeholder:text-faint"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={go}
        disabled={busy || !active}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {active ? `Claim for ${formatUsd(active.amountCents)}` : "Choose a spot"}
      </button>

      <p className="mt-3 text-center text-xs text-faint">
        Already listed? Enter the same URL and it upgrades your listing in
        place.{" "}
        <Link href="/pricing" className="underline underline-offset-4">
          See every price
        </Link>
        .
      </p>
    </div>
  );
}
