"use client";

import { useEffect, useState } from "react";
import { Duration } from "@/lib/types";
import SiteIcon from "./SiteIcon";

type Props = {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  mode: "featured" | "permanent";
  spot?: number; // required for featured
  openPriceCents?: number;
  stealPriceCents?: number | null;
  durations: Duration[];
};

const DURATION_LABEL: Record<Duration, string> = {
  6: "6 hours",
  12: "12 hours",
  24: "24 hours",
  72: "3 days",
};

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function ClaimModal({
  open,
  onClose,
  onDone,
  mode,
  spot,
  openPriceCents,
  stealPriceCents,
  durations,
}: Props) {
  const [url, setUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [meta, setMeta] = useState<{ title: string; description: string; image: string | null; favicon: string | null } | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [duration, setDuration] = useState<Duration>(durations[0] ?? 6);
  const [bidCents, setBidCents] = useState(1000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setHandle("");
      setMeta(null);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function fetchMeta() {
    if (!url) return;
    setLoadingMeta(true);
    setError(null);
    try {
      let normalized = url.trim();
      if (!/^https?:\/\//.test(normalized)) normalized = `https://${normalized}`;
      const res = await fetch(`/api/og?url=${encodeURIComponent(normalized)}`);
      const data = await res.json();
      setMeta(data);
      setUrl(normalized);
    } catch {
      setError("Couldn't fetch that link's metadata — you can still submit it.");
    } finally {
      setLoadingMeta(false);
    }
  }

  const requiredPrice =
    mode === "featured" ? Math.max(openPriceCents ?? 0, stealPriceCents ?? 0) : Math.max(500, bidCents);

  async function submit() {
    if (!url) {
      setError("Paste a URL first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let normalized = url.trim();
      if (!/^https?:\/\//.test(normalized)) normalized = `https://${normalized}`;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          url: normalized,
          handle: handle || null,
          title: meta?.title || normalized,
          description: meta?.description || "",
          image: meta?.image || null,
          favicon: meta?.favicon || null,
          spot,
          durationHours: mode === "featured" ? duration : undefined,
          amountCents: mode === "permanent" ? bidCents : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      onDone();
      onClose();
    } catch {
      setError("Network error — try again.");
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="surface w-full max-w-md rounded-lg p-6 shadow-2xl animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-2xl tracking-tight">
          {mode === "featured" ? `Claim Spot #${spot}` : "Bid for the leaderboard"}
        </h3>
        <p className="mt-1 text-sm text-ink-mute">
          {mode === "featured"
            ? "No account needed — paste your link, pick a duration, pay."
            : "Higher total bids rank higher, forever. No expiry."}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="num text-[11px] uppercase tracking-[0.14em] text-ink-faint">URL or @handle</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={fetchMeta}
              placeholder="yourproject.com"
              className="mt-2 w-full rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-cash"
            />
          </div>

          {loadingMeta && <p className="num text-[11px] text-ink-faint">Fetching preview…</p>}

          {meta && (
            <div className="flex items-center gap-3 rounded-md border border-line p-2">
              <SiteIcon src={meta.favicon} title={meta.title || "?"} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{meta.title}</p>
                <p className="truncate text-xs text-ink-mute">{meta.description}</p>
              </div>
            </div>
          )}

          {mode === "featured" ? (
            <div>
              <label className="num text-[11px] uppercase tracking-[0.14em] text-ink-faint">Duration</label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {durations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`num rounded-md border px-2 py-2 text-[11px] transition-colors ${
                      duration === d
                        ? "border-cash bg-cash/10 text-cash"
                        : "border-line hover:border-line-strong"
                    }`}
                  >
                    {DURATION_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="num text-[11px] uppercase tracking-[0.14em] text-ink-faint">Your bid (USD)</label>
              <input
                type="number"
                min={5}
                step={1}
                value={bidCents / 100}
                onChange={(e) => setBidCents(Math.round(Number(e.target.value) * 100))}
                className="mt-2 w-full rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-cash"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-baseline justify-between border-t border-line pt-4">
            <span className="num text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              {mode === "featured" && (stealPriceCents ?? 0) > (openPriceCents ?? 0) ? "Steal price" : "Price"}
            </span>
            <span className="num text-2xl font-semibold text-cash">{money(requiredPrice)}</span>
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-md bg-cash py-3 text-sm font-semibold text-[#04120a] transition-colors hover:bg-cash-bright disabled:opacity-50"
          >
            {submitting ? "Processing…" : `Pay ${money(requiredPrice)} & go live`}
          </button>
          <p className="text-center text-[11px] text-ink-faint">
            Test mode — no real charge unless Stripe live keys are configured.
          </p>
        </div>
      </div>
    </div>
  );
}
