"use client";

import { ChevronDown, Eye, MousePointerClick } from "lucide-react";
import { useId, useState } from "react";

import { LogoBubble, PlacementBadge } from "@/components/board-bits";
import { cn, faviconUrl } from "@/lib/utils";

/**
 * Live "what am I actually buying?" preview for the Extra Visibility options.
 *
 * The rows are built from the very same LogoBubble / PlacementBadge
 * components the real board renders, with the same spacing and colour tokens,
 * so the preview cannot drift away from the real thing.
 *
 * The example rows use well-known sites purely so the favicons and copy look
 * like a real board instead of placeholder text — the panel is labelled as an
 * example so nobody reads them as actual listings or endorsements.
 */

export type PreviewState = "normal" | "highlight" | "featured";

export interface PreviewSample {
  name: string;
  description: string;
  logoUrl: string | null;
  clickCount?: number;
  category?: string;
}

/** The row the buyer is shown "becoming" — replaced by their own site in the
 * buy dialog as soon as they type a URL. */
const DEFAULT_SUBJECT: PreviewSample = {
  name: "Stripe",
  description: "Financial infrastructure to grow your revenue.",
  logoUrl: faviconUrl("https://stripe.com"),
  clickCount: 1876,
  category: "SaaS & Tools",
};

const NEIGHBOUR_ABOVE: PreviewSample = {
  name: "GitHub",
  description: "Build and ship software on a single, collaborative platform.",
  logoUrl: faviconUrl("https://github.com"),
  clickCount: 2140,
  category: "SaaS & Tools",
};

const NEIGHBOUR_BELOW: PreviewSample = {
  name: "Notion",
  description: "One workspace for your docs, projects, and knowledge.",
  logoUrl: faviconUrl("https://notion.so"),
  clickCount: 1502,
  category: "SaaS & Tools",
};

const STATE_LABEL: Record<PreviewState, string> = {
  normal: "Normal listing",
  highlight: "With Highlight / Pin",
  featured: "With Featured badge",
};

const STATE_NOTE: Record<PreviewState, string> = {
  normal: "How a free listing looks by default.",
  highlight:
    "A soft gold tint plus a light-gold shimmer that travels around the row — the rank number is unchanged.",
  featured:
    "A gold “Featured” badge sits next to your name, and you sort above other free listings.",
};

function PreviewRow({
  sample,
  state,
  rank,
  dimmed = false,
}: {
  sample: PreviewSample;
  state: PreviewState;
  rank: number;
  dimmed?: boolean;
}) {
  const highlighted = state === "highlight";
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 px-3 py-3 transition-colors duration-300 sm:gap-4 sm:px-4",
        highlighted && "highlight-orbit bg-gold-soft",
        dimmed && "opacity-45",
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
          <span>{sample.category ?? "SaaS & Tools"}</span>
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="h-3.5 w-3.5" />
            {(sample.clickCount ?? 128).toLocaleString("en-US")}
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
  const subject = sample ?? DEFAULT_SUBJECT;

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
            <PreviewRow sample={NEIGHBOUR_ABOVE} state="normal" rank={12} dimmed />
            <div className="border-y border-border">
              <PreviewRow sample={subject} state={state} rank={13} />
            </div>
            <PreviewRow sample={NEIGHBOUR_BELOW} state="normal" rank={14} dimmed />
          </div>

          <p className="mt-2 text-xs text-faint">{STATE_NOTE[state]}</p>
          <p className="mt-1 text-xs text-faint">
            Visual emphasis only — neither option changes your rank number.
            Example rows only; these are not real listings.
          </p>
        </div>
      )}
    </div>
  );
}
