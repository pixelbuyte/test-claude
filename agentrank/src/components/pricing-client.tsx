"use client";

import {
  ArrowUpRight,
  Check,
  Crown,
  Loader2,
  MousePointerClick,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  ExtraVisibilityPreview,
  type PreviewSample,
} from "@/components/listing-preview";
import {
  CATALOG,
  FEATURED_OPEN_ITEMS,
  formatUsd,
  HIGHLIGHT_ITEMS,
  PERMANENT_ITEMS,
  TIER_CAPACITY,
  TIER_ITEMS,
  TIER_LABEL,
  type CatalogItem,
  type Tier,
} from "@/lib/pricing";
import {
  cn,
  deriveNameFromUrl,
  faviconUrl,
  normalizeUrl,
} from "@/lib/utils";

/* ────────────────────────── Purchase dialog ────────────────────────── */

function PurchaseDialog({
  sku,
  onClose,
}: {
  sku: string;
  onClose: () => void;
}) {
  const item = CATALOG.find((i) => i.sku === sku)!;
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Returning from Stripe via the back button restores this from the bfcache
  // with busy still true, leaving the buy button permanently dead.
  useEffect(() => {
    const revive = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false);
    };
    window.addEventListener("pageshow", revive);
    return () => window.removeEventListener("pageshow", revive);
  }, []);

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: item.sku, url }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        fallback?: boolean;
      };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        setBusy(false);
        return;
      }
      // Same as the hero: a fallback link carries no listing, so the buyer has
      // to be told their URL travels in the Stripe notes, not automatically.
      if (data.fallback) {
        setManualUrl(data.url);
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  };

  const canSubmit = url.trim().length > 3;

  // For the extras, preview the buyer's own listing as soon as they type a
  // URL — their real favicon, their real name, no upload or form-filling.
  const isExtra = item.kind === "highlight" || item.kind === "featured_open";
  const previewSample: PreviewSample | undefined = useMemo(() => {
    if (!isExtra) return undefined;
    const normalized = normalizeUrl(url);
    if (!normalized) return undefined;
    return {
      name: deriveNameFromUrl(normalized),
      description: "Your description is pulled from your site automatically.",
      logoUrl: faviconUrl(normalized),
    };
  }, [isExtra, url]);

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
              Fixed price of{" "}
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
            className="rounded-full border border-border p-1.5 text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <label
            htmlFor="pd-url"
            className="text-xs font-medium tracking-wide text-faint uppercase"
          >
            Your site URL
          </label>
          <input
            id="pd-url"
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit && !busy) checkout();
            }}
            placeholder="acme.ai"
            className="mt-1.5 w-full rounded-lg border border-control-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-faint"
          />
          <p className="mt-2 text-xs text-faint">
            That&rsquo;s it — nothing else to fill in. Already listed? This
            upgrades that listing in place, no duplicate. New? We list it
            automatically, pulling the name, description, and favicon straight
            from the site.
          </p>
        </div>

        {isExtra && (
          <ExtraVisibilityPreview
            kind={item.kind === "highlight" ? "highlight" : "featured"}
            sample={previewSample}
            className="mt-4"
          />
        )}

        {error && (
          <p role="alert" aria-live="polite" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}

        {manualUrl && (
          <div className="mt-3 rounded-2xl border border-gold/40 bg-gold-soft p-4 text-sm">
            <p className="font-semibold">This deployment takes payment manually.</p>
            <p className="mt-1 text-muted">
              Checkout can&rsquo;t attach your link automatically here, so put{" "}
              <span className="text-foreground">{url}</span> in the notes at
              Stripe and the placement is applied by hand.
            </p>
            <a
              href={manualUrl}
              className="mt-3 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90"
            >
              Continue to payment
            </a>
          </div>
        )}

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

export interface PermanentOwnerInfo {
  id: string;
  name: string;
  status: "pending" | "active" | "rejected";
  clickCount: number;
}

export function PricingSections({
  permanentOwners,
  tierCounts,
}: {
  permanentOwners: Record<number, PermanentOwnerInfo>;
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
            const owner = permanentOwners[item.rank!];
            const ownedActive = owner?.status === "active" ? owner : null;
            const heldInactive = owner && owner.status !== "active";
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

                {ownedActive ? (
                  <>
                    <a
                      href={`/go/${ownedActive.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-border-strong hover:bg-raised"
                      title={`Visit ${ownedActive.name}`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {ownedActive.name}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-faint" />
                    </a>
                    <p className="mt-2 flex items-center gap-1 text-xs text-faint">
                      <MousePointerClick className="h-3.5 w-3.5" />
                      {ownedActive.clickCount.toLocaleString("en-US")} clicks
                    </p>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(heldInactive)}
                    onClick={() => setBuying(item.sku)}
                    className={cn(
                      "mt-5 rounded-full px-4 py-2 text-sm font-medium transition-opacity",
                      heldInactive
                        ? "cursor-not-allowed border border-border text-faint"
                        : "bg-accent text-accent-fg hover:opacity-90",
                    )}
                  >
                    {heldInactive ? "Unavailable" : "Claim this rank"}
                  </button>
                )}
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
                      free > 0 ? "text-success" : "text-danger",
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

      {/* Highlight / Pin — visual emphasis only, sold separately from tiers */}
      <section id="highlight" className="scroll-mt-24">
        <SectionHeading
          title="Highlight / Pin"
          note="Extra visual emphasis wherever your listing already sits on the board. This never changes your rank — presentation only."
        />
        <ExtraVisibilityPreview kind="highlight" className="mb-5" />
        <div className="grid gap-4 sm:grid-cols-3">
          {HIGHLIGHT_ITEMS.map((item) => (
            <ExtraCard key={item.sku} item={item} onBuy={() => setBuying(item.sku)} />
          ))}
        </div>
      </section>

      {/* Featured in Open Section — an add-on for free listings, not a tier */}
      <section id="featured-open" className="scroll-mt-24">
        <SectionHeading
          title="Featured in Open Section"
          note="For free listings only — a small paid visibility boost inside the open section below the paid tiers. It does not move you into Top 10/20/50."
        />
        <ExtraVisibilityPreview kind="featured" className="mb-5" />
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
          {FEATURED_OPEN_ITEMS.map((item) => (
            <ExtraCard key={item.sku} item={item} onBuy={() => setBuying(item.sku)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ExtraCard({ item, onBuy }: { item: CatalogItem; onBuy: () => void }) {
  // The section heading already names the option, so the card leads with the
  // duration — the only thing that differs between these cards.
  const duration = item.label.split("·")[1]?.trim() ?? item.label;
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold">{duration}</h3>
      <p className="mt-2 font-display text-2xl font-semibold">
        {formatUsd(item.amountCents)}
      </p>
      <button
        type="button"
        onClick={onBuy}
        className="mt-4 w-full rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-border-strong hover:bg-raised"
      >
        Buy
      </button>
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
        <Check className="h-3.5 w-3.5 text-success" />
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
