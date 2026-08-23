import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import RevenueCounter from "./RevenueCounter";

export default function Header({ revenueCents }: { revenueCents: number }) {
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-void/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <span className="font-display text-2xl uppercase leading-none tracking-crush transition-colors group-hover:text-acid">
            SuperSpot
          </span>
          <span className="num hidden text-[10px] uppercase tracking-[0.2em] text-dust sm:inline">
            playlocal.space
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <RevenueCounter cents={revenueCents} />
          <Link
            href="/admin"
            className="num hidden text-[11px] uppercase tracking-[0.18em] text-dust transition-colors hover:text-bone sm:inline"
          >
            Admin
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
