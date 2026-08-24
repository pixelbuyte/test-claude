"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ExtraVisibilityPreview } from "@/components/listing-preview";
import { deriveNameFromUrl, faviconUrl, normalizeUrl } from "@/lib/utils";

export function SubmitForm() {
  const [url, setUrl] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"active" | "pending" | null>(null);

  const field =
    "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-border-strong";

  const preview = useMemo(() => {
    const normalized = normalizeUrl(url);
    if (!normalized) return undefined;
    return {
      name: deriveNameFromUrl(normalized),
      description: "Your description is pulled from your site automatically.",
      logoUrl: faviconUrl(normalized),
    };
  }, [url]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ownerEmail }),
      });
      const data = (await res.json()) as {
        listing?: { status: string };
        error?: string;
      };
      if (!res.ok || !data.listing) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setDone(data.listing.status === "active" ? "active" : "pending");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-tier50" />
        <h2 className="mt-4 font-display text-xl font-semibold">
          {done === "active" ? "You're on the board!" : "Submitted for review"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          {done === "active"
            ? "Your free listing is live in the open section. Want more visibility? Timed tier placements start at $29 — always a fixed price."
            : "Free listings get a light review before going live. Check back shortly."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            View the board
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-raised"
          >
            See placements
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="sf-url" className="mb-1.5 block text-sm font-medium">
          Your link — website, X, LinkedIn, YouTube, Discord…
        </label>
        <input
          id="sf-url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="acme.com or x.com/acme"
          className={field}
        />
        <p className="mt-2 text-xs text-faint">
          That&rsquo;s all we need. Your name, description, and favicon are
          pulled from the site automatically.
        </p>
      </div>

      <div>
        <label htmlFor="sf-email" className="mb-1.5 block text-sm font-medium">
          Email{" "}
          <span className="font-normal text-faint">
            (optional — for upgrade receipts)
          </span>
        </label>
        <input
          id="sf-email"
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="you@company.com"
          className={field}
        />
      </div>

      <ExtraVisibilityPreview kind="featured" sample={preview} />

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={busy || url.trim().length < 4}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        List for free
      </button>
      <p className="text-center text-xs text-faint">
        Free listings live in the open section below the paid tiers. No card, no
        account, no catch.
      </p>
    </form>
  );
}
