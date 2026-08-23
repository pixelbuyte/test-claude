const STEPS = [
  {
    n: "01",
    title: "Pick a spot",
    body: "5 featured slots up top, or the permanent leaderboard below. No account, no signup.",
  },
  {
    n: "02",
    title: "Choose your reign",
    body: "Featured spots run 6h, 12h, 24h, or 3 days. Better spots and longer reigns cost more.",
  },
  {
    n: "03",
    title: "Pay & go live instantly",
    body: "Stripe Checkout, test mode by default. Your link, favicon, and preview go live the second payment clears.",
  },
  {
    n: "04",
    title: "Get stolen (or steal back)",
    body: "Anyone can take your featured spot early by paying more than your remaining value + a premium. Timer resets, glory transfers.",
  },
];

export default function HowItWorks() {
  return (
    <section className="glass rounded-2xl p-6 sm:p-8">
      <h2 className="text-lg font-semibold">How it works</h2>
      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n}>
            <span className="text-2xl font-black text-brand-500/40">{s.n}</span>
            <h3 className="mt-2 font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
