"use client";

export default function RevenueCounter({ cents }: { cents: number }) {
  const dollars = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-neutral-500 dark:text-neutral-400">Total paid out</span>
      <span className="font-semibold tabular-nums">{dollars}</span>
    </div>
  );
}
