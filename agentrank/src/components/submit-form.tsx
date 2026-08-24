"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CATEGORIES } from "@/lib/types";

export function SubmitForm() {
  const [form, setForm] = useState({
    name: "",
    url: "",
    description: "",
    logoUrl: "",
    category: "ai_agents",
    ownerEmail: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"active" | "pending" | null>(null);

  const field =
    "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-border-strong";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        <label htmlFor="sf-name" className="mb-1.5 block text-sm font-medium">
          Name
        </label>
        <input
          id="sf-name"
          required
          minLength={2}
          maxLength={60}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Acme Support Agent"
          className={field}
        />
      </div>
      <div>
        <label htmlFor="sf-url" className="mb-1.5 block text-sm font-medium">
          Link — website, X, LinkedIn, YouTube, Discord…
        </label>
        <input
          id="sf-url"
          required
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="acme.ai or x.com/acme"
          className={field}
        />
      </div>
      <div>
        <label htmlFor="sf-desc" className="mb-1.5 block text-sm font-medium">
          Short description{" "}
          <span className="font-normal text-faint">
            ({120 - form.description.length} left)
          </span>
        </label>
        <input
          id="sf-desc"
          required
          maxLength={120}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What does it do, in one sentence?"
          className={field}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sf-category" className="mb-1.5 block text-sm font-medium">
            Category
          </label>
          <select
            id="sf-category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={field}
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sf-logo" className="mb-1.5 block text-sm font-medium">
            Logo URL <span className="font-normal text-faint">(optional)</span>
          </label>
          <input
            id="sf-logo"
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            placeholder="https://…/logo.png"
            className={field}
          />
        </div>
      </div>
      <div>
        <label htmlFor="sf-email" className="mb-1.5 block text-sm font-medium">
          Email <span className="font-normal text-faint">(optional — for upgrade receipts)</span>
        </label>
        <input
          id="sf-email"
          type="email"
          value={form.ownerEmail}
          onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
          placeholder="you@company.com"
          className={field}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={busy}
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
