import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import RevenueCounter from "./RevenueCounter";

export default function Header({ revenueCents }: { revenueCents: number }) {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 dark:border-white/5 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-black dark:bg-white text-sm font-black text-brand-400 dark:text-brand-600">S</span>
          <span className="text-lg font-bold tracking-tight">SuperSpot</span>
        </Link>
        <div className="hidden sm:block">
          <RevenueCounter cents={revenueCents} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="hidden rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition sm:inline-block"
          >
            Admin
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
