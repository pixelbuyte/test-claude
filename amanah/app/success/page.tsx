"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BOOST_TIERS } from "@/lib/pricing";

function SuccessContent() {
  const params = useSearchParams();
  const type = params.get("type");
  const rank = params.get("rank");
  const hours = Number(params.get("hours"));
  const tier = BOOST_TIERS.find((t) => t.hours === hours);

  const headline =
    type === "permanent" && rank
      ? `Rank ${rank} is yours. Permanently.`
      : tier
      ? `Your ${tier.label} boost is live.`
      : "Payment received.";

  const detail =
    type === "permanent"
      ? "Your tool now holds this rank forever — nobody can outbid, outrank, or displace it."
      : type === "boost"
      ? "Your tool is on the boost feed now, ordered by time remaining. When the clock runs out, the placement simply ends — no auto-renew, no surprises."
      : "Your placement is being finalized.";

  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="rise mx-auto grid h-20 w-20 place-items-center">
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <path d="M32 2 L39 25 L62 32 L39 39 L32 62 L25 39 L2 32 L25 25 Z" fill="#0b3d2e" />
          <path
            d="M22 32 l7 7 l13 -14"
            fill="none"
            stroke="#d9b64a"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className="rise mt-6 font-display text-4xl font-semibold text-emerald-900" style={{ animationDelay: "80ms" }}>
        {headline}
      </h1>
      <p className="rise mx-auto mt-4 max-w-md text-ink/65" style={{ animationDelay: "160ms" }}>
        {detail}
      </p>
      <p className="rise mt-2 text-sm text-ink/50" style={{ animationDelay: "200ms" }}>
        If you paid through Stripe, your placement appears as soon as the payment
        confirmation lands — usually within seconds.
      </p>
      <Link
        href="/"
        className="rise mt-8 inline-block rounded-full bg-emerald-900 px-6 py-3 font-medium text-ivory shadow-card transition hover:bg-emerald-800"
        style={{ animationDelay: "240ms" }}
      >
        See the board
      </Link>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
