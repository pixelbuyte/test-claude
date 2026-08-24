import { Ban, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Rules & how ranking works",
  description:
    "UPrank is not an auction. All prices are fixed and public — you buy a specific rank or a place in a tier for a fixed time.",
};

const PRINCIPLES = [
  {
    title: "This is not an auction",
    body: "There is no bidding, no counter-bidding, and no real-time price competition of any kind. Every option is a published fixed price for a clearly defined placement. This structure is deliberate — it keeps the board Islamic-permissible and fair: you buy a known thing for a known price, like a sponsored ad slot.",
  },
  {
    title: "Permanent Top 5",
    body: "Ranks #1–#5 are sold once each, as a one-time fixed payment for that specific rank. A sold rank shows as Owned and stays with its owner until they cancel. Nobody can pay to displace a permanent owner, at any price.",
  },
  {
    title: "Timed tier placements",
    body: "A tier package guarantees your listing a place inside its tier (Top 10, Top 20, or Top 50) for the exact duration you bought. Within a tier, listings are ordered first come, first served — by when the placement started, never by the amount paid. When your time is up, the placement expires automatically and the listing returns to the open section.",
  },
  {
    title: "Money never reorders a tier",
    body: "Two listings in the same tier are never ranked against each other by price. Buying a longer duration buys more time, not a higher position. The only way to appear in a higher tier is to buy that tier's fixed-price package — if a slot is open.",
  },
  {
    title: "Limited slots, shown openly",
    body: "The Top 10 tier holds 5 concurrent placements (positions 6–10), the Top 20 tier holds 10, and the Top 50 tier holds 30. Availability is displayed on the pricing page, and a full tier simply cannot be bought into until a placement expires.",
  },
  {
    title: "The open section is free, forever",
    body: "Anyone can list any website, tool, or social profile at no cost — just paste the link and the name, description, and favicon are pulled from the site automatically. Free listings rank by real outbound clicks — genuine interest, not payment. The optional Featured badge adds visibility inside the open section; it does not move a listing into a paid tier.",
  },
  {
    title: "Highlights never change rank",
    body: "The Highlight / Pin option adds visual emphasis to your row wherever it already is. It is presentation only — your rank stays exactly the same.",
  },
  {
    title: "One listing, upgraded in place",
    body: "Buying any placement for an existing listing upgrades that listing directly. Duplicates are never created, and repurchasing the same tier extends your current placement's time.",
  },
  {
    title: "Real numbers only",
    body: "Click counts are real outbound clicks tracked by the site. The live visitor counter reflects actual visitors in the last five minutes.",
  },
  {
    title: "Refunds & conflicts",
    body: "If a race ever means a purchase can no longer be honored (for example, two buyers completing checkout for the same permanent rank within seconds), the later payment is flagged and refunded in full — the rank is never double-sold.",
  },
];

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 pb-8 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Rules &amp; how ranking works
      </h1>
      <p className="mt-4 text-lg text-muted">
        UPrank exists to make paid visibility{" "}
        <span className="text-foreground">fair, transparent, and simple</span>.
        Everything below is enforced in code, not just policy.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-danger/30 bg-surface p-5">
          <Ban className="h-5 w-5 text-danger" />
          <h2 className="mt-3 font-display font-semibold">Never</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li>Open or hidden bidding</li>
            <li>Prices that change with demand</li>
            <li>Ranking timed listings by amount paid</li>
            <li>Reselling an owned permanent rank</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-tier50/30 bg-surface p-5">
          <CheckCircle2 className="h-5 w-5 text-tier50" />
          <h2 className="mt-3 font-display font-semibold">Always</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            <li>Published fixed prices</li>
            <li>The exact amount shown before payment</li>
            <li>Automatic expiry of timed placements</li>
            <li>A free open section for everyone</li>
          </ul>
        </div>
      </div>

      <div className="mt-10 space-y-8">
        {PRINCIPLES.map((p, i) => (
          <section key={p.title}>
            <h2 className="font-display text-lg font-semibold">
              <span className="mr-2 text-faint tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
            {p.title}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {p.body}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-muted">
          Questions about a placement, a renewal, or a refund?
        </p>
        <p className="mt-1 text-sm">
          See the{" "}
          <Link href="/pricing" className="underline underline-offset-4">
            full price list
          </Link>{" "}
          or{" "}
          <Link href="/submit" className="underline underline-offset-4">
            start with a free listing
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
