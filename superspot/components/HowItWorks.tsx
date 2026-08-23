const STEPS = [
  {
    n: "01",
    title: "Pick a spot",
    body: "Five slots up top, or the all-time board below. No account, no signup, no email.",
  },
  {
    n: "02",
    title: "Set your clock",
    body: "6 hours, 12, 24, or 3 days. Better spots and longer reigns cost more.",
  },
  {
    n: "03",
    title: "Go live",
    body: "Stripe takes the money, your link and preview hit the board the second it clears.",
  },
  {
    n: "04",
    title: "Defend it",
    body: "Anyone can take your spot early by covering what's left on your clock plus a premium. Clock resets. Bragging rights move.",
  },
];

export default function HowItWorks() {
  return (
    <section>
      <p className="rule-label mb-8">The rules</p>
      <div className="grid gap-px bg-edge sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="bg-void p-5 transition-colors hover:bg-panel">
            <span className="font-display text-5xl leading-none tracking-crush text-edge-hot">
              {s.n}
            </span>
            <h3 className="mt-4 font-display text-xl uppercase leading-none tracking-crush">
              {s.title}
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ash">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
