/** Answers the question a first-time visitor actually has: if someone takes
 *  my spot, who gets that money? Being vague here reads as a scam. */
const FACTS: Array<{ q: string; a: string }> = [
  {
    q: "Where does the money go?",
    a: "To SuperSpot. This is an ad slot, not a marketplace — you are buying placement from the site, not from the person you took it from.",
  },
  {
    q: "Do I get paid when I'm stolen from?",
    a: "No. You bought a window of exposure and you keep whatever traffic it sent before the spot changed hands. There is no payout and no refund.",
  },
  {
    q: "So why is stealing expensive?",
    a: "The price covers whatever is left on the current holder's clock plus a premium that's steepest right after they claim it — and never drops below the spot's own rental price.",
  },
  {
    q: "What does the permanent board cost?",
    a: "Whatever you want to put down. It never expires and never gets stolen — the only way to drop is somebody else spending more.",
  },
];

export default function MoneyRules({ totalCents }: { totalCents: number }) {
  const total = (totalCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <section>
      <p className="rule-label mb-6">How the money works</p>

      <div className="panel p-5 sm:p-6">
        <p className="text-sm text-ash">
          <span className="font-display text-3xl tracking-crush text-acid">{total}</span>{" "}
          <span className="align-middle">
            has been spent on this board to date — that is money paid{" "}
            <em className="not-italic text-bone">to SuperSpot</em> for placement,
            not passed between users.
          </span>
        </p>

        <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {FACTS.map((f) => (
            <div key={f.q} className="border-t border-edge pt-3">
              <dt className="font-display text-base uppercase leading-tight tracking-crush">
                {f.q}
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ash">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
