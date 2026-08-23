"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("superspot-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="grid h-9 w-9 place-items-center rounded-full border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 transition"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
