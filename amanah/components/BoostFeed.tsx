import Link from "next/link";
import Countdown from "./Countdown";
import { BoardPayload } from "@/lib/types";
import { BOOST_TIERS, formatUsd } from "@/lib/pricing";

function tierLabel(hours: number): string {
  return BOOST_TIERS.find((t) => t.hours === hours)?.label ?? `${hours} hours`;
}

export default function BoostFeed({ board }: { board: BoardPayload }) {
  const { boosts, now } = board;

  return (
    <section aria-labelledby="boost-heading" className="mt-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 id="boost-heading" className="font-display text-3xl font-semibold text-emerald-900">
            Boosted right now
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Timed placements at fixed prices, ordered by time remaining. When the clock runs out,
            the spot simply frees up.
          </p>
        </div>
        <Link
          href="/submit?type=boost"
          className="hidden shrink-0 rounded-full border border-emerald-900 px-4 py-1.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-900 hover:text-ivory sm:block"
        >
          Start a boost
        </Link>
      </div>

      {boosts.length === 0 ? (
        <div className="card border-dashed !bg-parchment/60 p-10 text-center">
          <p className="font-display text-xl text-emerald-900">No active boosts</p>
          <p className="mt-2 text-sm text-ink/60">
            Be the first on the feed — boosts start at {formatUsd(BOOST_TIERS[0].cents)} for{" "}
            {BOOST_TIERS[0].label}.
          </p>
        </div>
      ) : (
        <ol className="grid gap-3">
          {boosts.map((boost, i) => {
            const total = boost.expiresAt - boost.startedAt;
            const remaining = Math.max(0, boost.expiresAt - now);
            const pct = Math.max(2, Math.min(100, (remaining / total) * 100));
            return (
              <li key={boost.id} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
                <a
                  href={boost.tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card group flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="flex min-w-0 items-baseline gap-3">
                      <span className="font-mono text-sm text-ink/40">{String(i + 1).padStart(2, "0")}</span>
                      <h3 className="font-display text-xl font-semibold text-emerald-900 group-hover:underline decoration-gold-500/60 underline-offset-4">
                        {boost.tool.name}
                      </h3>
                      <span className="rounded-full bg-emerald-900/5 px-2 py-0.5 text-xs text-emerald-800">
                        {tierLabel(boost.hours)} · {formatUsd(boost.priceCents)}
                      </span>
                    </div>
                    <p className="text-sm text-emerald-800">
                      <span className="shimmer mr-1.5 inline-block h-2 w-2 rounded-full bg-gold-500 align-middle" />
                      <Countdown expiresAt={boost.expiresAt} /> left
                    </p>
                  </div>
                  <p className="text-sm text-ink/70">{boost.tool.description}</p>
                  <div className="h-1 overflow-hidden rounded-full bg-emerald-900/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-800 to-gold-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
