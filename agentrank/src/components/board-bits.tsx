"use client";

import { Clock, Crown, Share, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { Placement } from "@/lib/ranking";
import { TIER_LABEL } from "@/lib/pricing";
import { cn, timeLeft } from "@/lib/utils";

/** Ticking "time remaining" label for timed placements. */
export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const exact = new Date(expiresAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const remaining = timeLeft(expiresAt, now);
  return (
    <span title={`Until ${exact}`} suppressHydrationWarning>
      {remaining === "expired" ? "expired" : `${remaining} left`}
    </span>
  );
}

export function PlacementBadge({ placement }: { placement: Placement }) {
  if (placement.kind === "permanent") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft px-2.5 py-1 text-[11px] font-semibold tracking-wide text-gold uppercase">
        <Crown className="h-3 w-3" />
        Permanent #{placement.rank}
      </span>
    );
  }
  if (placement.kind === "boost") {
    const styles = {
      top10: "border-tier10/40 bg-tier10-soft text-tier10",
      top20: "border-tier20/40 bg-tier20-soft text-tier20",
      top50: "border-tier50/40 bg-tier50-soft text-tier50",
    }[placement.tier];
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
          styles,
        )}
      >
        <Clock className="h-3 w-3" />
        {TIER_LABEL[placement.tier]} · <Countdown expiresAt={placement.expiresAt} />
      </span>
    );
  }
  if (placement.featured) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft px-2.5 py-1 text-[11px] font-semibold tracking-wide text-gold uppercase">
        <Sparkles className="h-3 w-3" />
        Featured
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-medium tracking-wide text-faint uppercase">
      Free
    </span>
  );
}

export function ShareOnX({ name, rank }: { name: string; rank: number }) {
  const share = () => {
    const site =
      typeof window !== "undefined" ? window.location.origin : "";
    const text = `${name} is ranked #${rank} on UPrank — the fixed-price leaderboard for any site. ${site}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  return (
    <button
      type="button"
      onClick={share}
      aria-label={`Share ${name} on X`}
      title="Share on X"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-faint transition-colors hover:border-border-strong hover:text-foreground"
    >
      <Share className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * The listing's favicon, with the name's initials painted underneath as a
 * permanent backstop. The image only fades in once it has actually decoded,
 * so a slow, blocked, or transparent favicon degrades to initials instead of
 * an empty square — `onError` alone isn't enough, since a request that hangs
 * never fires it.
 */
export function LogoBubble({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // The <img> is server-rendered, so the browser frequently finishes loading
  // it BEFORE React hydrates and attaches onLoad — in which case that event
  // never fires and the image would stay invisible forever. A ref callback
  // runs on mount and catches the already-complete case.
  const captureLoadedState = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-raised font-display text-sm font-semibold text-muted">
      {name.slice(0, 2).toUpperCase()}
      {logoUrl && !broken && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external hosts
        <img
          ref={captureLoadedState}
          src={logoUrl}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
          // object-contain + padding: favicons are small squares, and
          // cropping or stretching them looks worse than letting them sit.
          className={cn(
            "absolute inset-0 h-full w-full bg-raised object-contain p-1.5 transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}

export function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("en-US");
}
