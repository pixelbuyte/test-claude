"use client";

import { Check, Crown, Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  CATALOG,
  formatUsd,
  HIGHLIGHT_ITEMS,
  PERMANENT_ITEMS,
  TIER_CAPACITY,
  TIER_ITEMS,
  TIER_LABEL,
  type CatalogItem,
  type Tier,
} from "@/lib/pricing";
import { CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PickerListing {
  id: string;
  name: string;
  url: string;
}

/* ────────────────────────── Purchase dialog ────────────────────────── */

function PurchaseDialog({
  sku,
  onClose,
}: {
  sku: string;
  onClose: () => void;
}) {
  const item = CATALOG.find((i) => i.sku === sku)!;
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [listings, setListings] = useState<PickerListing[] | null>(null);
  const [listingId, setListingId] = useState("");
  const [form, setForm] = useState({
    name: "",
    url: "",
    description: "",
    category: "ai_agents",
    ownerEmail: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/listings")
      .then((r) => r.json())
      .then((data: { listings?: PickerListing[] }) => {
        const list = data.listings ?? [];
        setListings(list);
        if (list.length === 0) setMode("new");
      })
      .catch(() => setListings([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const body =
        mode === "existing"
          ? { sku: item.sku, listingId }
          : { sku: item.sku, newListing: form };
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const canSubmit =
    mode === "existing"
      ? listingId !== ""
      : form.name.trim().length >= 2 && form.url.trim().length > 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold">{item.label}</h3>
            <p className="mt-1 text-sm text-muted">
              You are buying exactly this, at a fixed price of{" "}
              <span className="font-semibold text-foreground">
                {formatUsd(item.amountCents)}
              </span>
              . One-time payment — no auction, no recurring charge.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            autoFocus
            className="rounded-full border border-border p-1.5 text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode("existing")}
            disabled={listings?.length === 0}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 transition-colors disabled:opacity-40",
              mode === "existing"
                ? "border-transparent bg-accent text-accent-fg"
                : "border-border text-muted hover:text-foreground",
            )}
          >
            Existing listing
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 transition-colors",
              mode === "new"
                ? "border-transparent bg-accent text-accent-fg"
                : "border-border text-muted hover:text-foreground",
            )}
          >
            New listing
          </button>
        </div>

        {mode === "existing" ? (
          <div className="mt-4">
            <label
              htmlFor="pd-listing"
              className="text-xs font-medium tracking-wide text-faint uppercase"
            >
              Apply the placement to
            </label>
            <select
              id="pd-listing"
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-border-strong"
            >
              <option value="">
                {listings === null ? "Loading listings…" : "Choose your listing…"}
              </option>
              {(listings ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-faint">
              Buying for a listing that is already on the board upgrades it in
              place — no duplicates are ever created.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Product name"
              maxLength={60}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-border-strong"
            />
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="Website or social link"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-border-strong"
            />
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short description (120 chars max)"
              maxLength={120}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-border-strong"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-border-strong"
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="button"
          onClick={checkout}
          disabled={!canSubmit || busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Pay {formatUsd(item.amountCents)} — secure Stripe checkout
        </button>
        <p className="mt-3 text-center text-xs text-faint">
          The exact amount above is what you will be charged. Timed placements
          expire automatically.
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────── Pricing sections ────────────────────────── */

export function PricingSections({
  takenRanks,
  tierCounts,
}: {
  takenRanks: number[];
  tierCounts: Record<Tier, number>;
}) {
  const [buying, setBuying] = useState<string | null>(null);

  return (
    <div className="space-y-16">
      {buying && (
        <PurchaseDialog sku={buying} onClose={() => setBuying(null)} />
      )}

      {/* Permanent slots */}
      <section id="permanent" className="scroll-mt-24">
        <SectionHeading
          title="Permanent Top 5"
          note="One-time payment for a specific rank. Yours until you cancel — never resold behind your back."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PERMANENT_ITEMS.map((item) => {
            const taken = takenRanks.includes(item.rank!);
            return (
              <div
                key={item.sku}
                className={cn(
                  "flex flex-col rounded-2xl border p-5",
                  item.rank === 1
                    ? "border-gold/50 bg-gold-soft"
                    : "border-border bg-surface",
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gold uppercase">
                  <Crown className="h-3.5 w-3.5" /> Rank #{item.rank}
                </span>
                <span className="mt-3 font-display text-2xl font-semibold">
                  {formatUsd(item.amountCents)}
                </span>
                <span className="mt-1 text-xs text-faint">
                  one-time · permanent
                </span>
                <button
                  type="button"
                  disabled={taken}
                  onClick={() => setBuying(item.sku)}
                  className={cn(
                    "mt-5 rounded-full px-4 py-2 text-sm font-medium transition-opacity",
                    taken
                      ? "cursor-not-allowed border border-border text-faint"
                      : "bg-accent text-accent-fg hover:opacity-90",
                  )}
                >
                  {taken ? "Owned" : "Claim this rank"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Timed tiers */}
      <section id="timed" className="scroll-mt-24">
        <SectionHeading
          title="Timed tier placements"
          note="A guaranteed place inside the tier for a fixed duration. Within a tier, order is first come, first served — never who paid more."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {(["top10", "top20", "top50"] as Tier[]).map((tier) => {
            const free = TIER_CAPACITY[tier] - tierCounts[tier];
            return (
              <div
                key={tier}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-lg font-semibold">
                    {TIER_LABEL[tier]} tier
                  </h3>
                  <span
                    className={cn(
                      "text-xs",
                      free > 0 ? "text-tier50" : "text-danger",
                    )}
                  >
                    {free > 0
                      ? `${free} of ${TIER_CAPACITY[tier]} slots open`
                      : "Currently full"}
                  </span>
                </div>
                <ul className="mt-4 divide-y divide-border">
                  {TIER_ITEMS(tier).map((item) => (
                    <PriceRow
                      key={item.sku}
                      item={item}
                      disabled={free <= 0}
                      onBuy={() => setBuying(item.sku)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Extras */}
      <section id="extras" className="scroll-mt-24">
        <SectionHeading
          title="Extra visibility"
          note="Visual emphasis only — a highlight never changes your rank."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...HIGHLIGHT_ITEMS, CATALOG.find((i) => i.kind === "featured_open")!].map(
            (item) => (
              <div
                key={item.sku}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <h3 className="text-sm font-semibold">{item.label}</h3>
                <p className="mt-2 font-display text-2xl font-semibold">
                  {formatUsd(item.amountCents)}
                </p>
                <button
                  type="button"
                  onClick={() => setBuying(item.sku)}
                  className="mt-4 w-full rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-border-strong hover:bg-raised"
                >
                  Buy
                </button>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm text-muted">{note}</p>
    </div>
  );
}

function PriceRow({
  item,
  disabled,
  onBuy,
}: {
  item: CatalogItem;
  disabled: boolean;
  onBuy: () => void;
}) {
  const duration = item.label.split("·")[1]?.trim() ?? "";
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-2 text-sm">
        <Check className="h-3.5 w-3.5 text-tier50" />
        {duration}
      </span>
      <span className="flex items-center gap-3">
        <span className="font-display text-sm font-semibold tabular-nums">
          {formatUsd(item.amountCents)}
        </span>
        <button
          type="button"
          onClick={onBuy}
          disabled={disabled}
          className="rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors hover:border-border-strong hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
        >
          Buy
        </button>
      </span>
    </li>
  );
}
