"use client";

export default function RevenueCounter({ cents }: { cents: number }) {
  const dollars = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <span className="num inline-flex items-baseline gap-2 text-[11px]">
      <span className="hidden uppercase tracking-[0.14em] text-ink-faint sm:inline">
        Paid out
      </span>
      <span className="font-semibold text-cash">{dollars}</span>
    </span>
  );
}
