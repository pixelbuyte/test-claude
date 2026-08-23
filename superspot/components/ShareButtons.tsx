"use client";

export default function ShareButtons({ text }: { text: string }) {
  const url = typeof window !== "undefined" ? window.location.href : "https://superspot.app";

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="flex items-center gap-2">
      <a
        href={xHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition"
      >
        Share on 𝕏
      </a>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(url);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition"
      >
        Copy link
      </button>
    </div>
  );
}
