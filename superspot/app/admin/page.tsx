"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminSettings, Duration } from "@/lib/types";

export default function AdminPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  async function save(next: AdminSettings) {
    setSettings(next);
    setSaved(false);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const updated = await res.json();
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (!settings) {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center text-neutral-400">Loading…</div>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Base prices, durations, and content filters. No auth on this demo route — lock it down before going live.
          </p>
        </div>
        <Link href="/" className="text-sm underline hover:text-brand-500">
          ← Back
        </Link>
      </div>

      <section className="glass mt-8 rounded-2xl p-6">
        <h2 className="font-semibold">Base prices (6h rate, per spot)</h2>
        <div className="mt-4 grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((spot) => (
            <div key={spot}>
              <label className="text-xs text-neutral-500">Spot #{spot}</label>
              <input
                type="number"
                value={(settings.basePricesCents[spot] ?? 0) / 100}
                onChange={(e) =>
                  save({
                    ...settings,
                    basePricesCents: {
                      ...settings.basePricesCents,
                      [spot]: Math.round(Number(e.target.value) * 100),
                    },
                  })
                }
                className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-black/30 px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="glass mt-6 rounded-2xl p-6">
        <h2 className="font-semibold">Duration multipliers</h2>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {([6, 12, 24, 72] as Duration[]).map((d) => (
            <div key={d}>
              <label className="text-xs text-neutral-500">{d}h</label>
              <input
                type="number"
                step="0.1"
                value={settings.durationMultipliers[d] ?? 1}
                onChange={(e) =>
                  save({
                    ...settings,
                    durationMultipliers: {
                      ...settings.durationMultipliers,
                      [d]: Number(e.target.value),
                    },
                  })
                }
                className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-black/30 px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <label className="text-xs text-neutral-500">Max duration allowed (hours)</label>
          <select
            value={settings.maxDurationHours}
            onChange={(e) => save({ ...settings, maxDurationHours: Number(e.target.value) as Duration })}
            className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-black/30 px-2 py-1.5 text-sm"
          >
            {[6, 12, 24, 72].map((d) => (
              <option key={d} value={d}>
                {d}h
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="glass mt-6 rounded-2xl p-6">
        <h2 className="font-semibold">Steal / outbid premium</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Percent above the current occupant's remaining value required to take their spot early.
        </p>
        <input
          type="number"
          value={settings.outbidPremiumPct}
          onChange={(e) => save({ ...settings, outbidPremiumPct: Number(e.target.value) })}
          className="mt-3 w-32 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-black/30 px-2 py-1.5 text-sm"
        />
        <span className="ml-2 text-sm">%</span>
      </section>

      <section className="glass mt-6 rounded-2xl p-6">
        <h2 className="font-semibold">Banned keywords</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Any listing whose URL, title, or description contains one of these is rejected at checkout.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {settings.bannedKeywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-500"
            >
              {kw}
              <button
                onClick={() =>
                  save({ ...settings, bannedKeywords: settings.bannedKeywords.filter((k) => k !== kw) })
                }
                className="font-bold"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="add a keyword…"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-black/30 px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => {
              if (!newKeyword.trim()) return;
              save({ ...settings, bannedKeywords: [...settings.bannedKeywords, newKeyword.trim()] });
              setNewKeyword("");
            }}
            className="rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Add
          </button>
        </div>
      </section>

      <section className="glass mt-6 rounded-2xl p-6">
        <h2 className="font-semibold">Banned categories</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {settings.bannedCategories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-500"
            >
              {cat}
              <button
                onClick={() =>
                  save({ ...settings, bannedCategories: settings.bannedCategories.filter((c) => c !== cat) })
                }
                className="font-bold"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="add a category…"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-black/30 px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => {
              if (!newCategory.trim()) return;
              save({ ...settings, bannedCategories: [...settings.bannedCategories, newCategory.trim()] });
              setNewCategory("");
            }}
            className="rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Add
          </button>
        </div>
      </section>

      {saved && <p className="mt-4 text-center text-sm text-emerald-500">Saved ✓</p>}
    </main>
  );
}
