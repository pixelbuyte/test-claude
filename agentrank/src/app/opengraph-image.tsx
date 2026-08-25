import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The link preview card for X, Slack, iMessage and friends.
 *
 * It redraws the landing page's own hero rather than screenshotting it: a
 * screenshot goes stale the moment the page changes and gets unreadable once
 * a timeline scales it down, while this stays vector-crisp at card size and
 * reads the same palette the site does. Rendered at build time, so nothing
 * here runs per request.
 */

export const alt =
  "URank — the public leaderboard for any site or tool. Fixed prices, no auctions.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same tokens as globals.css. Repeated as literals because Satori resolves no
// CSS variables -- if the palette moves there, it has to move here too.
const BG = "#f8f4ef";
const INK = "#1a1714";
const MUTED = "#5b5349";
const FAINT = "#73685c";
const ACCENT = "#d24622";
const HEADLINE_ACCENT = "#b6510e";
const GOLD = "#7c5204";
const BORDER = "#e7ded3";
const SURFACE = "#ffffff";

const TILES = [
  { label: "PERMANENT RANKS", value: "#1–#5", note: "Yours until you cancel" },
  { label: "TIMED TIERS", value: "From $29", note: "1 hour to 7 days" },
  { label: "OPEN SECTION", value: "Free", note: "Forever, any link" },
];

export default async function Image() {
  const [medium, bold] = await Promise.all([
    readFile(join(process.cwd(), "assets/SpaceGrotesk-Medium.woff")),
    readFile(join(process.cwd(), "assets/SpaceGrotesk-Bold.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "62px 68px",
          background: BG,
          // Stands in for the hero's two radial washes, which is as close as
          // Satori gets without risking an unsupported gradient.
          backgroundImage: `linear-gradient(135deg, rgba(214,158,46,0.13) 0%, rgba(248,244,239,0) 42%), linear-gradient(300deg, rgba(182,81,14,0.12) 0%, rgba(248,244,239,0) 46%)`,
          fontFamily: "Space Grotesk",
          color: INK,
        }}
      >
        {/* Wordmark + the promise the whole product rests on */}
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 60,
                height: 60,
                borderRadius: 16,
                background: ACCENT,
              }}
            >
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em" }}>
              URank
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 22px",
              borderRadius: 999,
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              fontSize: 21,
              fontWeight: 500,
              color: MUTED,
            }}
          >
            Fixed prices · fixed durations · no auctions, ever
          </div>
        </div>

        {/* The hero headline, wrapped exactly where the page wraps it */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.06 }}>
            The public leaderboard
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.06,
            }}
          >
            <div>for&nbsp;</div>
            <div style={{ color: HEADLINE_ACCENT }}>any site or tool</div>
            <div>.</div>
          </div>
          <div style={{ marginTop: 22, fontSize: 27, fontWeight: 500, color: MUTED }}>
            A fixed, published price for every placement — nobody can outbid you.
          </div>
        </div>

        {/* The price ladder, the part people actually want off a preview */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 16 }}>
            {TILES.map((t) => (
              <div
                key={t.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: 268,
                  padding: "18px 22px",
                  borderRadius: 18,
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    letterSpacing: "0.09em",
                    color: FAINT,
                  }}
                >
                  {t.label}
                </div>
                <div style={{ marginTop: 6, fontSize: 34, fontWeight: 700, color: GOLD }}>
                  {t.value}
                </div>
                <div style={{ marginTop: 3, fontSize: 18, fontWeight: 500, color: MUTED }}>
                  {t.note}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 25, fontWeight: 700, color: HEADLINE_ACCENT }}>
            playlocal.space
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: medium, weight: 500, style: "normal" },
        { name: "Space Grotesk", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
