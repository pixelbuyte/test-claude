const STEPS = [
  {
    n: "01",
    title: "Pick a spot",
    body: "Five featured slots up top, or the permanent board below. No account, no signup.",
  },
  {
    n: "02",
    title: "Choose your reign",
    body: "Featured spots run 6h, 12h, 24h, or 3 days. Better spots and longer reigns cost more.",
  },
  {
    n: "03",
    title: "Pay, go live",
    body: "Stripe Checkout. Your link, favicon and preview appear the second payment clears.",
  },
  {
    n: "04",
    title: "Get stolen",
    body: "Anyone can take your spot early by paying out your remaining value plus a premium. Timer resets, glory transfers.",
  },
];

export default function HowItWorks() {
  return (
    <section>
      <p className="rule-label mb-6">How it works</p>
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="border-t border-line pt-4">
            <span className="num text-[11px] tracking-[0.14em] text-cash">{s.n}</span>
            <h3 className="mt-3 font-display text-xl leading-tight tracking-tight">
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-mute">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
