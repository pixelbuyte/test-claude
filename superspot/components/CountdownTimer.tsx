"use client";

import { useEffect, useState } from "react";

function format(msLeft: number) {
  if (msLeft <= 0) return "expired";
  const s = Math.floor(msLeft / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export default function CountdownTimer({
  expiresAt,
  onExpire,
  className,
}: {
  expiresAt: number;
  onExpire?: () => void;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = expiresAt - now;
  useEffect(() => {
    if (remaining <= 0) onExpire?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining <= 0]);

  const urgent = remaining > 0 && remaining < 15 * 60 * 1000;

  return (
    <span
      className={`num ${urgent ? "text-red-400 animate-pulseglow" : ""} ${className ?? ""}`}
    >
      {format(remaining)}
    </span>
  );
}
