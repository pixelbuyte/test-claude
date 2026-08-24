import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-ivory/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="text-xl text-gold-500 transition-transform group-hover:rotate-45 inline-block">✦</span>
          <span className="font-display text-2xl font-semibold tracking-tight text-emerald-900">
            Amanah
          </span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-ink/50 sm:inline">
            the honest board
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/pricing" className="text-ink/70 transition-colors hover:text-emerald-900">
            Pricing
          </Link>
          <Link
            href="/submit"
            className="rounded-full bg-emerald-900 px-4 py-2 font-medium text-ivory shadow-card transition hover:bg-emerald-800 hover:shadow-lift"
          >
            List your tool
          </Link>
        </nav>
      </div>
    </header>
  );
}
