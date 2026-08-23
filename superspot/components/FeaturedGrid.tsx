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
  payments,
}: {
  entries: FeaturedEntry[];
  durations: Duration[];
  onRefresh: () => void;
  onClick: (listingId: string) => void;
  payments?: { enabled: boolean; live: boolean; minAmountCents: number };
}) {
  const [modalSpot, setModalSpot] = useState<FeaturedEntry | null>(null);
  const [hero, ...rest] = entries;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {hero && (
          <HeroSlot
            entry={hero}
            onOpen={() => setModalSpot(hero)}
            onRefresh={onRefresh}
            onClick={onClick}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {rest.slice(0, 2).map((entry, i) => (
            <Slot
              key={entry.spot}
              entry={entry}
              delay={(i + 1) * 70}
              onOpen={() => setModalSpot(entry)}
              onRefresh={onRefresh}
              onClick={onClick}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {rest.slice(2).map((entry, i) => (
          <Slot
            key={entry.spot}
            entry={entry}
            delay={(i + 3) * 70}
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
        payments={payments}
      />
    </>
  );
}

function Status({ entry, onRefresh }: { entry: FeaturedEntry; onRefresh: () => void }) {
  if (!entry.claim) {
    return (
      <span className="num flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-acid">
        <span className="h-2 w-2 animate-blink bg-acid" />
        Open
      </span>
    );
  }
  return (
    <span className="num flex items-center gap-1.5 text-[11px] text-ash">
      <span className="text-dust">ENDS</span>
      <CountdownTimer expiresAt={entry.claim.expiresAt} onExpire={onRefresh} />
    </span>
  );
}

/** The whole price row is the button — big money, hard edge, no rounding. */
function Bid({
  entry,
  onOpen,
  big,
}: {
  entry: FeaturedEntry;
  onOpen: () => void;
  big?: boolean;
}) {
  const taken = !!entry.claim;
  const price = taken ? entry.stealPriceCents ?? entry.openPriceCents : entry.openPriceCents;

  return (
    <button
      onClick={onOpen}
      className={`group/b flex w-full items-center gap-3 border-t px-1 pt-3 text-left transition-colors ${
        taken ? "border-edge hover:border-hot" : "border-edge hover:border-acid"
      }`}
    >
      <span
        className={`num text-[11px] uppercase tracking-[0.18em] ${
          taken ? "text-hot" : "text-acid"
        }`}
      >
        {taken ? "Steal it" : "Claim it"}
      </span>
      <span
        className={`font-display leading-none tracking-crush ${
          big ? "text-4xl" : "text-2xl"
        } ${taken ? "text-hot" : "text-acid"} group-hover/b:glow`}
      >
        {money(price)}
      </span>
      <span className="num ml-auto text-lg text-dust transition-transform group-hover/b:translate-x-1">
        →
      </span>
    </button>
  );
}

function HeroSlot({
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
    <div className="deal panel panel-lift-acid relative flex flex-col justify-between overflow-hidden p-5 sm:p-6 lg:col-span-2">
      {/* The rank numeral is architecture, not decoration — it's the
          biggest thing on the panel and it bleeds off the corner. */}
      <span className="ghost-rank pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 text-[11rem] sm:text-[15rem]">
        01
      </span>

      <div className="relative flex items-center justify-between">
        <span className="num bg-acid px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#07070a]">
          Top spot
        </span>
        <Status entry={entry} onRefresh={onRefresh} />
      </div>

      {l ? (
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => onClick(l.id)}
          className="group relative my-8 flex items-start gap-4"
        >
          <SiteIcon src={l.favicon} title={l.title} className="mt-1 h-14 w-14 text-2xl" />
          <div className="min-w-0">
            <h3 className="font-display text-4xl uppercase leading-[0.9] tracking-crush transition-colors group-hover:text-acid sm:text-6xl">
              {l.title}
            </h3>
            <p className="mt-3 line-clamp-2 max-w-md text-sm text-ash">
              {l.description || l.url.replace(/^https?:\/\//, "")}
            </p>
          </div>
        </a>
      ) : (
        <div className="relative my-8">
          <h3 className="font-display text-4xl uppercase leading-[0.9] tracking-crush text-dust sm:text-6xl">
            Nobody
            <br />
            owns this
          </h3>
          <p className="mt-3 max-w-sm text-sm text-ash">
            The most expensive pixels on the page, sitting empty.
          </p>
        </div>
      )}

      <div className="relative">
        <p className="num mb-3 text-[11px] uppercase tracking-[0.18em] text-dust">
          {l ? `${l.clicks.toLocaleString()} clicks sent` : "Awaiting first owner"}
        </p>
        <Bid entry={entry} onOpen={onOpen} big />
      </div>
    </div>
  );
}

function Slot({
  entry,
  onOpen,
  onRefresh,
  onClick,
  delay,
}: {
  entry: FeaturedEntry;
  onOpen: () => void;
  onRefresh: () => void;
  onClick: (id: string) => void;
  delay: number;
}) {
  const l = entry.listing;

  return (
    <div
      className="deal panel panel-lift relative flex flex-col justify-between overflow-hidden p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="ghost-rank pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 text-[6.5rem]">
        {String(entry.spot).padStart(2, "0")}
      </span>

      <div className="relative flex items-center justify-between">
        <span className="num text-[11px] uppercase tracking-[0.18em] text-dust">
          Spot {String(entry.spot).padStart(2, "0")}
        </span>
        <Status entry={entry} onRefresh={onRefresh} />
      </div>

      {l ? (
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => onClick(l.id)}
          className="group relative my-5 flex items-center gap-3"
        >
          <SiteIcon src={l.favicon} title={l.title} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate font-display text-xl uppercase leading-none tracking-crush transition-colors group-hover:text-acid">
              {l.title}
            </p>
            <p className="num truncate text-[11px] text-dust">
              {l.clicks.toLocaleString()} clicks
            </p>
          </div>
        </a>
      ) : (
        <div className="relative my-5 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 border border-dashed border-edge-hot" />
          <p className="font-display text-xl uppercase leading-none tracking-crush text-dust">
            Empty
          </p>
        </div>
      )}

      <div className="relative">
        <Bid entry={entry} onOpen={onOpen} />
      </div>
    </div>
  );
}
