import Link from "next/link";
import { BoardPayload } from "@/lib/types";
import { formatUsd } from "@/lib/pricing";

const ORDINALS = ["", "First", "Second", "Third", "Fourth", "Fifth"];

function RankMedallion({ rank, big = false }: { rank: number; big?: boolean }) {
  return (
    <div
      className={`relative grid shrink-0 place-items-center ${big ? "h-16 w-16" : "h-12 w-12"}`}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full">
        <path
          d="M32 2 L39 25 L62 32 L39 39 L32 62 L25 39 L2 32 L25 25 Z"
          className="fill-emerald-900"
        />
        <path
          d="M32 8 L37.5 26.5 L56 32 L37.5 37.5 L32 56 L26.5 37.5 L8 32 L26.5 26.5 Z"
          fill="none"
          stroke="#c9a227"
          strokeWidth="1.5"
        />
      </svg>
      <span className={`relative font-display font-semibold text-gold-400 ${big ? "text-2xl" : "text-lg"}`}>
        {rank}
      </span>
    </div>
  );
}

function SlotCard({
  entry,
  big = false,
  index,
}: {
  entry: BoardPayload["permanent"][number];
  big?: boolean;
  index: number;
}) {
  const { rank, slot, priceCents, held } = entry;

  if (!slot) {
    return (
      <div
        className="rise card flex h-full flex-col items-start justify-between gap-4 border-dashed !bg-parchment/60 p-6"
        style={{ animationDelay: `${index * 90}ms` }}
      >
        <div className="flex w-full items-center gap-4">
          <RankMedallion rank={rank} big={big} />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-ink/50">
              {ORDINALS[rank]} rank · open
            </p>
            <p className="font-display text-xl text-emerald-900">
              {held ? "Reserved — checkout in progress" : "This rank is unclaimed"}
            </p>
          </div>
        </div>
        <div className="flex w-full items-center justify-between">
          <p className="font-mono text-lg text-emerald-900">
            {formatUsd(priceCents)}{" "}
            <span className="text-xs text-ink/50">one-time · fixed</span>
          </p>
          {!held && (
            <Link
              href={`/submit?type=permanent&rank=${rank}`}
              className="rounded-full border border-emerald-900 px-4 py-1.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-900 hover:text-ivory"
            >
              Claim rank {rank}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <a
      href={slot.tool.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`rise card group flex h-full flex-col justify-between gap-4 p-6 transition hover:-translate-y-0.5 hover:shadow-lift ${
        big ? "md:p-8" : ""
      }`}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="flex items-start gap-4">
        <RankMedallion rank={rank} big={big} />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-ink/50">
            {ORDINALS[rank]} rank · permanent
          </p>
          <h3
            className={`font-display font-semibold text-emerald-900 group-hover:underline decoration-gold-500/60 underline-offset-4 ${
              big ? "text-3xl" : "text-xl"
            }`}
          >
            {slot.tool.name}
          </h3>
        </div>
      </div>
      <p className={`text-ink/70 ${big ? "text-base" : "text-sm"}`}>{slot.tool.description}</p>
      <p className="truncate text-xs text-ink/40">{slot.tool.url}</p>
    </a>
  );
}

export default function PermanentBoard({ board }: { board: BoardPayload }) {
  const [first, ...rest] = board.permanent;
  return (
    <section aria-labelledby="permanent-heading">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 id="permanent-heading" className="font-display text-3xl font-semibold text-emerald-900">
            The Permanent Five
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Five ranks, each sold once at a fixed posted price. Once claimed, held forever.
          </p>
        </div>
        <Link href="/pricing" className="hidden text-sm text-emerald-800 underline decoration-gold-500/60 underline-offset-4 hover:text-emerald-900 sm:block">
          See all prices
        </Link>
      </div>
      <div className="grid gap-4">
        <SlotCard entry={first} big index={0} />
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.map((entry, i) => (
            <SlotCard key={entry.rank} entry={entry} index={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
