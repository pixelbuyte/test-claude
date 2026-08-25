"use client";

import { Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle light / dark mode"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-border-strong hover:text-foreground"
    >
      {/* Which icon shows is driven purely by the .dark class, so SSR and the
          first client render always agree. */}
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </button>
  );
}
