import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { formatUsd, getCatalogItem } from "@/lib/pricing";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment received",
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  let detail: { label: string; amount: string } | null = null;
  if (sessionId && isStripeConfigured()) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      const item = getCatalogItem(session.metadata?.sku ?? "");
      if (item && session.payment_status === "paid") {
        detail = { label: item.label, amount: formatUsd(item.amountCents) };
      }
    } catch {
      // Show the generic confirmation below.
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-20 pb-8 text-center sm:px-6">
      <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">
        Payment received — thank you!
      </h1>
      {detail ? (
        <p className="mt-4 text-muted">
          Your purchase of{" "}
          <span className="font-semibold text-foreground">{detail.label}</span>{" "}
          for <span className="font-semibold text-foreground">{detail.amount}</span>{" "}
          is confirmed. The board updates automatically within a few seconds.
        </p>
      ) : (
        <p className="mt-4 text-muted">
          Your placement activates automatically as soon as Stripe confirms the
          payment — usually within a few seconds. A confirmation email is on
          its way.
        </p>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg hover:opacity-90"
        >
          See your listing on the board
        </Link>
      </div>
      <p className="mt-6 text-xs text-faint">
        Timed placements expire automatically at the end of their duration —
        exactly as purchased, never extended or shortened by other buyers.
      </p>
    </div>
  );
}
