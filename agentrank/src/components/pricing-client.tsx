"use client";

import {
  ArrowUpRight,
  Check,
  Crown,
  MousePointerClick,
} from "lucide-react";
import { useState } from "react";

import { ExtraVisibilityPreview } from "@/components/listing-preview";
import { PurchaseDialog } from "@/components/purchase-dialog";
import {
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
import { cn } from "@/lib/utils";

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
              // Own anchor per tier: an expired row on the board links
              // straight to the tier whose slot just came free, rather than
              // dropping the buyer at the top of all three.
              <div
                key={tier}
                id={tier}
                className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5"
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
