"use client";

import { useState } from "react";
import { Listing, FeaturedClaim, Duration } from "@/lib/types";
import CountdownTimer from "./CountdownTimer";
import ClaimModal from "./ClaimModal";
import SiteIcon from "./SiteIcon";

export type FeaturedEntry = {
  spot: number;
  claim: FeaturedClaim | null;
  listing: Listing | null;
  openPriceCents: number;
  stealPriceCents: number | null;
};

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function FeaturedGrid({
  entries,
  durations,
  onRefresh,
  onClick,
}: {
  entries: FeaturedEntry[];
  durations: Duration[];
  onRefresh: () => void;
  onClick: (listingId: string) => void;
}) {
  const [modalSpot, setModalSpot] = useState<FeaturedEntry | null>(null);

  const [hero, ...rest] = entries;

  return (
    <>
      {/* Spot #1 gets its own full-width stage; the remaining four sit in a
          quieter row beneath it. The hierarchy is the product — the top spot
          should visibly be worth more than the others. */}
      <div className="grid gap-3 lg:grid-cols-3">
        {hero && (
          <HeroCard
            entry={hero}
            onOpen={() => setModalSpot(hero)}
            onRefresh={onRefresh}
            onClick={onClick}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
          {rest.slice(0, 2).map((entry) => (
            <SmallCard
              key={entry.spot}
              entry={entry}
              onOpen={() => setModalSpot(entry)}
              onRefresh={onRefresh}
              onClick={onClick}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {rest.slice(2).map((entry) => (
          <SmallCard
            key={entry.spot}
            entry={entry}
            onOpen={() => setModalSpot(entry)}
            onRefresh={onRefresh}
            onClick={onClick}
          />
        ))}
      </div>

      <ClaimModal
        open={!!modalSpot}
        onClose={() => setModalSpot(null)}
        onDone={onRefresh}
        mode="featured"
        spot={modalSpot?.spot}
        openPriceCents={modalSpot?.openPriceCents}
        stealPriceCents={modalSpot?.stealPriceCents}
        durations={durations}
      />
    </>
  );
}

function SpotTag({ spot, gold }: { spot: number; gold?: boolean }) {
  return (
    <span
      className={`num text-[11px] font-medium tracking-[0.14em] ${
        gold ? "text-gold" : "text-ink-faint"
      }`}
    >
      SPOT {String(spot).padStart(2, "0")}
    </span>
  );
}

function Status({
  entry,
  onRefresh,
}: {
  entry: FeaturedEntry;
  onRefresh: () => void;
}) {
  if (!entry.claim) {
    return (
      <span className="num flex items-center gap-1.5 text-[11px] text-cash">
        <span className="h-1.5 w-1.5 rounded-full bg-cash" />
        OPEN
      </span>
    );
  }
  return (
    <CountdownTimer
      expiresAt={entry.claim.expiresAt}
      onExpire={onRefresh}
      className="text-[11px] text-ink-mute"
    />
  );
}

function PriceButton({
  entry,
  onOpen,
  large,
}: {
  entry: FeaturedEntry;
  onOpen: () => void;
  large?: boolean;
}) {
  const occupied = !!entry.claim;
  const price = occupied ? entry.stealPriceCents ?? entry.openPriceCents : entry.openPriceCents;

  return (
    <button
      onClick={onOpen}
      className={`group/btn flex items-baseline gap-2 border-t border-line pt-3 text-left transition-colors hover:border-line-strong ${
        large ? "w-full" : "w-full"
      }`}
    >
      <span className="num text-[11px] uppercase tracking-[0.14em] text-ink-faint transition-colors group-hover/btn:text-ink">
        {occupied ? "Steal" : "Claim"}
      </span>
      <span
        className={`num font-semibold text-cash ${large ? "text-2xl" : "text-lg"}`}
      >
        {money(price)}
      </span>
      <span className="ml-auto text-ink-faint transition-transform group-hover/btn:translate-x-0.5">
        →
      </span>
    </button>
  );
}

function HeroCard({
  entry,
  onOpen,
  onRefresh,
  onClick,
}: {
  entry: FeaturedEntry;
  onOpen: () => void;
  onRefresh: () => void;
  onClick: (id: string) => void;
}) {
  const l = entry.listing;

  return (
    <div className="surface relative flex flex-col justify-between rounded-lg p-5 sm:p-6 lg:col-span-2">
      {/* A single gold hairline along the top edge is the only ornament the
          top spot gets — enough to rank it, not enough to shout. */}
      <span className="absolute inset-x-0 top-0 h-px bg-gold/50" />

      <div className="flex items-center justify-between">
        <SpotTag spot={entry.spot} gold />
        <Status entry={entry} onRefresh={onRefresh} />
      </div>

      {l ? (
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => onClick(l.id)}
          className="group my-6 block"
        >
          <div className="flex items-start gap-4">
            <SiteIcon src={l.favicon} title={l.title} className="mt-1 h-12 w-12 text-xl" />
            <div className="min-w-0">
              <h3 className="font-display text-3xl leading-[1.1] tracking-tight transition-colors group-hover:text-cash sm:text-4xl">
                {l.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-ink-mute">
                {l.description || l.url.replace(/^https?:\/\//, "")}
              </p>
            </div>
          </div>
        </a>
      ) : (
        <div className="my-6">
          <h3 className="font-display text-3xl italic leading-[1.1] text-ink-faint sm:text-4xl">
            This space is unclaimed
          </h3>
          <p className="mt-2 text-sm text-ink-mute">
            The most valuable slot on the page. Nobody has taken it yet.
          </p>
        </div>
      )}

      <div>
        <p className="num mb-3 text-[11px] text-ink-faint">
          {l ? `${l.clicks.toLocaleString()} CLICKS` : "NO CLICKS YET"}
        </p>
        <PriceButton entry={entry} onOpen={onOpen} large />
      </div>
    </div>
  );
}

function SmallCard({
  entry,
  onOpen,
  onRefresh,
  onClick,
}: {
  entry: FeaturedEntry;
  onOpen: () => void;
  onRefresh: () => void;
  onClick: (id: string) => void;
}) {
  const l = entry.listing;

  return (
    <div className="surface flex flex-col justify-between rounded-lg p-4">
      <div className="flex items-center justify-between">
        <SpotTag spot={entry.spot} />
        <Status entry={entry} onRefresh={onRefresh} />
      </div>

      {l ? (
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => onClick(l.id)}
          className="group my-4 flex items-center gap-3"
        >
          <SiteIcon src={l.favicon} title={l.title} />
          <div className="min-w-0">
            <p className="truncate font-medium transition-colors group-hover:text-cash">
              {l.title}
            </p>
            <p className="num truncate text-[11px] text-ink-faint">
              {l.clicks.toLocaleString()} clicks
            </p>
          </div>
        </a>
      ) : (
        <div className="my-4 flex items-center gap-3">
          <div className="h-8 w-8 shrink-0 rounded border border-dashed border-line-strong" />
          <p className="font-display text-lg italic text-ink-faint">Unclaimed</p>
        </div>
      )}

      <PriceButton entry={entry} onOpen={onOpen} />
    </div>
  );
}
