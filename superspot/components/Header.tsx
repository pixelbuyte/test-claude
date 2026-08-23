import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import RevenueCounter from "./RevenueCounter";

export default function Header({ revenueCents }: { revenueCents: number }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl tracking-tight">SuperSpot</span>
          <span className="num hidden text-[10px] uppercase tracking-[0.18em] text-ink-faint sm:inline">
            playlocal.space
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <RevenueCounter cents={revenueCents} />
          <Link
            href="/admin"
            className="num hidden text-[11px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-ink sm:inline"
          >
            Admin
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
