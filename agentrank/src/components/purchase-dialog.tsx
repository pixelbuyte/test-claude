"use client";

import { Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  ExtraVisibilityPreview,
  type PreviewSample,
} from "@/components/listing-preview";
import { CATALOG, formatUsd } from "@/lib/pricing";
import { deriveNameFromUrl, faviconUrl, normalizeUrl } from "@/lib/utils";

/**
 * One fixed-price item, one URL field, straight to Stripe. Lives on its own so
 * the board can open it too, not just /pricing: a "Rent now · $129" button that
 * dropped someone on the pricing page made them re-pick their price out of six
 * durations they had not asked about, which is the step that lost them. From
 * the board this is the whole purchase — click, paste link, pay.
 */
export function PurchaseDialog({
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
