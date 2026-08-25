"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The total counts UP to each new value instead of snapping. The board
 * polls every 8s, so without the tween a $50 claim looks identical to a
 * page load — the one number that proves the site is live has to move.
 */
function useCountUp(target: number) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const frame = useRef<number>();

  useEffect(() => {
    const start = from.current;
    const delta = target - start;

    // First paint, no change, or a reduced-motion preference: snap.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (delta === 0 || reduced) {
      from.current = target;
      setValue(target);
      return;
    }

    const t0 = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(start + delta * eased));
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      from.current = target;
    };
  }, [target]);

  return value;
}

export default function RevenueCounter({ cents }: { cents: number }) {
  const shown = useCountUp(cents);
  const dollars = (shown / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <span className="flex items-center gap-2">
      <span className="num hidden items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-dust sm:flex">
        <span className="ping h-1.5 w-1.5 shrink-0 bg-acid" aria-hidden />
        Spent here
      </span>
      <span className="num font-display text-xl leading-none tracking-crush text-acid">
        {dollars}
      </span>
    </span>
  );
}
