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
  payments?: { enabled: boolean; live: boolean; minAmountCents: number };
};

/** Quick-pick amounts. On featured spots these are added on top of the floor. */
const PRESETS = [500, 2500, 10000, 50000];

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
  payments,
}: Props) {
  const [url, setUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [meta, setMeta] = useState<{ title: string; description: string; image: string | null; favicon: string | null } | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [duration, setDuration] = useState<Duration>(durations[0] ?? 6);
  // Buyer-chosen amount, in cents. null = "just pay the asking price".
  const [customCents, setCustomCents] = useState<number | null>(null);
  const [customText, setCustomText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setHandle("");
      setMeta(null);
      setError(null);
      setSubmitting(false);
      setCustomCents(null);
      setCustomText("");
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

  const minAmount = payments?.minAmountCents ?? 100;
  // Featured spots have a floor you can pay over but not under; the permanent
  // board has no ceiling and no asking price at all.
  const floorCents =
    mode === "featured" ? Math.max(openPriceCents ?? 0, stealPriceCents ?? 0) : minAmount;
  const chargeCents = Math.max(floorCents, customCents ?? 0);
  const belowFloor = customCents !== null && customCents < floorCents;

  function setAmountFromText(text: string) {
    setCustomText(text);
    const trimmed = text.trim();
    if (trimmed === "") {
      setCustomCents(null);
      return;
    }
    const dollars = Number(trimmed.replace(/[$,\s]/g, ""));
    setCustomCents(Number.isFinite(dollars) ? Math.round(dollars * 100) : null);
  }

  async function submit() {
    if (!url) {
      setError("Paste a URL first.");
      return;
    }
    if (mode === "permanent" && customCents === null) {
      setError("Enter how much you want to put down.");
      return;
    }
    if (belowFloor) {
      setError(`This spot costs at least ${money(floorCents)} right now.`);
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
          amountCents: mode === "permanent" ? chargeCents : customCents ?? undefined,
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
        className="panel panel-lift-acid deal w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-3xl uppercase tracking-crush">
          {mode === "featured" ? `Claim Spot #${spot}` : "Bid for the leaderboard"}
        </h3>
        <p className="mt-1 text-sm text-ash">
          {mode === "featured"
            ? "No account needed — paste your link, pick a duration, pay."
            : "Higher total bids rank higher, forever. No expiry."}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="num text-[11px] uppercase tracking-[0.14em] text-dust">URL or @handle</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={fetchMeta}
              placeholder="yourproject.com"
              className="mt-2 w-full border border-edge bg-panel-2 px-3 py-2 text-sm outline-none transition-colors focus:border-acid"
            />
          </div>

          {loadingMeta && <p className="num text-[11px] text-dust">Fetching preview…</p>}

          {meta && (
            <div className="flex items-center gap-3 border border-edge p-2">
              <SiteIcon src={meta.favicon} title={meta.title || "?"} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{meta.title}</p>
                <p className="truncate text-xs text-ash">{meta.description}</p>
              </div>
            </div>
          )}

          {mode === "featured" && (
            <div>
              <label className="num text-[11px] uppercase tracking-[0.14em] text-dust">Duration</label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {durations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`num border px-2 py-2 text-[11px] transition-colors ${
                      duration === d
                        ? "border-acid bg-acid/10 text-acid"
                        : "border-edge hover:border-edge-hot"
                    }`}
                  >
                    {DURATION_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="num text-[11px] uppercase tracking-[0.14em] text-dust">
              {mode === "featured" ? "Pay extra (optional)" : "How much are you putting down?"}
            </label>

            <div className="mt-2 grid grid-cols-4 gap-2">
              {PRESETS.map((cents) => {
                const amount = mode === "featured" ? floorCents + cents : cents;
                return (
                  <button
                    key={cents}
                    onClick={() => {
                      setCustomCents(amount);
                      setCustomText(String(amount / 100));
                    }}
                    className={`num border px-2 py-2 text-[11px] transition-colors ${
                      customCents === amount
                        ? "border-acid bg-acid/10 text-acid"
                        : "border-edge hover:border-edge-hot"
                    }`}
                  >
                    {mode === "featured" ? `+$${cents / 100}` : `$${cents / 100}`}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center border border-edge bg-panel-2 transition-colors focus-within:border-acid">
              <span className="num pl-3 text-sm text-dust">$</span>
              <input
                inputMode="decimal"
                value={customText}
                onChange={(e) => setAmountFromText(e.target.value)}
                placeholder={
                  mode === "featured"
                    ? `${(floorCents / 100).toFixed(2)} or more`
                    : "any amount"
                }
                className="num w-full bg-transparent px-2 py-2.5 text-sm outline-none"
              />
            </div>

            <p className="num mt-2 text-[10px] leading-relaxed text-dust">
              {mode === "featured"
                ? "Overpaying raises the price of stealing this spot from you."
                : "No minimum ranking, no maximum. Highest total sits highest, forever."}
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-baseline justify-between border-t border-edge pt-4">
            <span className="num text-[11px] uppercase tracking-[0.14em] text-dust">
              {mode === "featured" && (stealPriceCents ?? 0) > (openPriceCents ?? 0)
                ? "Steal price"
                : "You pay"}
            </span>
            <span className="num font-display text-3xl tracking-crush text-acid">
              {money(chargeCents)}
            </span>
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full num press border border-acid bg-acid py-3.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#07070a] hover:shadow-[4px_4px_0_0_var(--edge-hot)] disabled:opacity-40"
          >
            {submitting ? "Processing…" : `Pay ${money(chargeCents)} & go live`}
          </button>
          <p className="text-center text-[11px] text-dust">
            {!payments?.enabled
              ? "Demo mode — nothing is charged and the board resets on redeploy."
              : payments.live
              ? "Live mode — your card will actually be charged."
              : "Stripe test mode — use card 4242 4242 4242 4242, no real charge."}
          </p>
        </div>
      </div>
    </div>
  );
}
