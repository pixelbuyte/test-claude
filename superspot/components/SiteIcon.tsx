"use client";

import { useState } from "react";

/** Favicons fail often — dead sites, hotlink blocks, and ad blockers that
 *  eat the Google s2 service. Fall back to a monogram tile so a row never
 *  renders a broken-image glyph. */
export default function SiteIcon({
  src,
  title,
  className = "h-8 w-8",
}: {
  src?: string | null;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (title.trim()[0] ?? "?").toUpperCase();

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={`${className} grid shrink-0 place-items-center border border-edge bg-panel-2 font-display uppercase text-dust`}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 bg-panel-2 object-contain`}
    />
  );
}
