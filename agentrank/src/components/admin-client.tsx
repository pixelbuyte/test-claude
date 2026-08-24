"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatUsd, getCatalogItem, TIER_LABEL } from "@/lib/pricing";
import { CATEGORIES, type Listing, type Payment } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Login failed.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Admin password"
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-border-strong"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </button>
    </form>
  );
}

function placementSummary(l: Listing): string {
  const parts: string[] = [];
  if (l.permanentRank) parts.push(`Permanent #${l.permanentRank}`);
  if (l.boostTier && l.boostExpiresAt) {
    parts.push(
      `${TIER_LABEL[l.boostTier]} until ${new Date(l.boostExpiresAt).toLocaleString()}`,
    );
  }
  if (parts.length === 0) parts.push("Open section");
  return parts.join(" · ");
}

export function AdminDashboard({
  listings,
  payments,
  revenueCents,
}: {
  listings: Listing[];
  payments: Payment[];
  revenueCents: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = async (
    action: string,
    id: string,
    extra?: Record<string, string>,
  ) => {
    setBusyId(id);
    await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, ...extra }),
    });
    setBusyId(null);
    router.refresh();
  };

  const pending = listings.filter((l) => l.status === "pending");

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Revenue (completed)", value: formatUsd(revenueCents) },
          { label: "Listings", value: String(listings.length) },
          { label: "Awaiting review", value: String(pending.length) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs tracking-wide text-faint uppercase">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Listings</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs tracking-wide text-faint uppercase">
                <th className="px-4 py-3 font-medium">Listing</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Placement</th>
                <th className="px-4 py-3 font-medium">Clicks</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listings.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{l.name}</p>
                    <p className="max-w-60 truncate text-xs text-faint">{l.url}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        l.status === "active" && "bg-tier50-soft text-tier50",
                        l.status === "pending" && "bg-gold-soft text-gold",
                        l.status === "rejected" && "text-danger",
                      )}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={l.category}
                      disabled={busyId === l.id}
                      onChange={(e) =>
                        act("set_category", l.id, { category: e.target.value })
                      }
                      className="rounded-lg border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-border-strong disabled:opacity-50"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className="px-4 py-3 text-xs text-muted"
                    suppressHydrationWarning
                  >
                    {placementSummary(l)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{l.clickCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {busyId === l.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-faint" />
                      ) : (
                        <>
                          {l.status !== "active" && (
                            <AdminButton onClick={() => act("approve", l.id)}>
                              Approve
                            </AdminButton>
                          )}
                          {l.status !== "rejected" && (
                            <AdminButton onClick={() => act("reject", l.id)}>
                              Reject
                            </AdminButton>
                          )}
                          {(l.permanentRank || l.boostTier) && (
                            <AdminButton
                              onClick={() => act("clear_placements", l.id)}
                            >
                              Clear placements
                            </AdminButton>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">
          Recent payments
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-140 text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs tracking-wide text-faint uppercase">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No payments yet.
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td
                    className="px-4 py-3 text-xs text-muted"
                    suppressHydrationWarning
                  >
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {getCatalogItem(p.sku)?.label ?? p.sku}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatUsd(p.amountCents)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        p.status === "completed" && "text-tier50",
                        p.status === "pending" && "text-gold",
                        (p.status === "conflict" ||
                          p.status === "failed" ||
                          p.status === "refunded") &&
                          "text-danger",
                      )}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-faint">
          Refunds are issued from the Stripe dashboard — payments flagged
          “conflict” should always be refunded in full. Prices are edited in{" "}
          <code>src/lib/pricing.ts</code> (keep Stripe prices in sync).
        </p>
      </section>
    </div>
  );
}

function AdminButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:border-border-strong hover:bg-raised"
    >
      {children}
    </button>
  );
}
