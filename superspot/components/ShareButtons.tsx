"use client";

import { useState } from "react";

export default function ShareButtons({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? window.location.href : "https://playlocal.space";

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text
  )}&url=${encodeURIComponent(url)}`;

  const cls =
    "num press border border-edge px-3.5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-ash hover:border-acid hover:text-acid hover:shadow-[3px_3px_0_0_var(--edge)]";

  return (
    <div className="flex items-center gap-2">
      <a href={xHref} target="_blank" rel="noopener noreferrer" className={cls}>
        Share on 𝕏
      </a>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className={cls}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
