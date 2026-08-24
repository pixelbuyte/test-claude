"use client";

export default function RevenueCounter({ cents }: { cents: number }) {
  const dollars = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <span className="flex items-baseline gap-2">
      <span className="num hidden text-[10px] uppercase tracking-[0.2em] text-dust sm:inline">
        Spent here
      </span>
      <span className="font-display text-xl leading-none tracking-crush text-acid">
        {dollars}
      </span>
    </span>
  );
}
