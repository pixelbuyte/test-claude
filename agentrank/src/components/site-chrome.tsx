"use client";

import { Menu, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Board" },
  { href: "/pricing", label: "Pricing" },
  { href: "/rules", label: "Rules" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <TrendingUp className="h-4.5 w-4.5" strokeWidth={2.4} />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            AgentRank
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm transition-colors",
                pathname === item.href
                  ? "bg-raised text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <Link
            href="/submit"
            className="hidden rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-85 sm:inline-flex"
          >
            List for free
          </Link>
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border px-4 py-3 md:hidden">
          {[...NAV, { href: "/submit", label: "List for free" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-raised hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-medium text-foreground">AgentRank</span> — the
          fixed-price leaderboard for AI agents &amp; automation tools.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/rules" className="hover:text-foreground">
            How ranking works
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/submit" className="hover:text-foreground">
            Submit a listing
          </Link>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-faint">
        Fixed prices. Fixed durations. No auctions, no outbidding — ever.
      </div>
    </footer>
  );
}
