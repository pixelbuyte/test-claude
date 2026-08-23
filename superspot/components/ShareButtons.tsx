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
    "num rounded-md border border-line-strong px-3 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors hover:border-cash hover:text-cash";

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
