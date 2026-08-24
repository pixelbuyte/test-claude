"use client";

import { ChevronDown, Eye, MousePointerClick } from "lucide-react";
import { useId, useState } from "react";

import { LogoBubble, PlacementBadge } from "@/components/board-bits";
import { cn } from "@/lib/utils";

/**
 * Live "what am I actually buying?" preview for the Extra Visibility options.
 *
 * The rows below are built from the very same LogoBubble / PlacementBadge
 * components the real board renders, with the same spacing and colour tokens,
 * so the preview cannot drift away from the real thing.
 */

export type PreviewState = "normal" | "highlight" | "featured";

export interface PreviewSample {
  name: string;
  description: string;
  logoUrl: string | null;
}

const FALLBACK_SAMPLE: PreviewSample = {
  name: "Your site",
  description: "Your description is pulled from your site automatically.",
  logoUrl: null,
};

const STATE_LABEL: Record<PreviewState, string> = {
  normal: "Normal listing",
  highlight: "With Highlight / Pin",
  featured: "With Featured badge",
};

const STATE_NOTE: Record<PreviewState, string> = {
  normal: "How a free listing looks by default.",
  highlight:
    "A warm highlight band and gold edge make the row stand out — the rank number is unchanged.",
  featured:
    "A gold “Featured” badge sits next to your name, and you sort above other free listings.",
};

/** A dimmed neighbouring row, so the emphasis is visible in context. */
function NeighbourRow({ rank, name }: { rank: number; name: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 opacity-45 sm:gap-4 sm:px-4">
      <span className="w-6 shrink-0 text-center font-display text-base font-semibold text-muted tabular-nums">
        {rank}
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-raised font-display text-sm font-semibold text-muted">
        {name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{name}</span>
        <span className="mt-1 block h-2 w-2/3 max-w-40 rounded-full bg-border" />
      </div>
    </div>
  );
}

function PreviewRow({
  sample,
  state,
  rank,
}: {
  sample: PreviewSample;
  state: PreviewState;
  rank: number;
}) {
  const highlighted = state === "highlight";
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 px-3 py-3 transition-colors duration-300 sm:gap-4 sm:px-4",
        highlighted && "bg-gold-soft ring-1 ring-gold/30 ring-inset",
      )}
    >
      <span className="w-6 shrink-0 text-center font-display text-base font-semibold text-muted tabular-nums">
        {rank}
      </span>
      <LogoBubble name={sample.name} logoUrl={sample.logoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[15px] font-semibold">
            {sample.name}
          </span>
          <PlacementBadge
            placement={{ kind: "free", featured: state === "featured" }}
          />
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {sample.description}
        </p>
        <p className="mt-1 flex items-center gap-3 text-xs text-faint">
          <span>SaaS &amp; Tools</span>
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="h-3.5 w-3.5" />
            128
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * Collapsed by default behind a "See how it looks" button, so it never
 * competes with the price. Opening it reveals tabs for each visual state.
 */
export function ExtraVisibilityPreview({
  kind,
  sample,
  className,
}: {
  kind: "highlight" | "featured";
  sample?: PreviewSample;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PreviewState>(
    kind === "highlight" ? "highlight" : "featured",
  );
  const panelId = useId();
  const row = sample ?? FALLBACK_SAMPLE;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:bg-raised hover:text-foreground"
      >
        <Eye className="h-3.5 w-3.5" />
        {open ? "Hide preview" : "See how it looks"}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div id={panelId} className="mt-3">
          <div
            role="tablist"
            aria-label="Preview state"
            className="flex flex-wrap gap-1.5"
          >
            {(Object.keys(STATE_LABEL) as PreviewState[]).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={state === s}
                onClick={() => setState(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  state === s
                    ? "border-transparent bg-accent text-accent-fg"
                    : "border-border text-muted hover:border-border-strong hover:text-foreground",
                )}
              >
                {STATE_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
            <NeighbourRow rank={12} name="Another listing" />
            <div className="border-y border-border">
              <PreviewRow sample={row} state={state} rank={13} />
            </div>
            <NeighbourRow rank={14} name="Something else" />
          </div>

          <p className="mt-2 text-xs text-faint">{STATE_NOTE[state]}</p>
          <p className="mt-1 text-xs text-faint">
            Visual emphasis only — neither option changes your rank number.
          </p>
        </div>
      )}
    </div>
  );
}
