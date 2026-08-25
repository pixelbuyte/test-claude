import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Anton, Chakra_Petch, DM_Mono } from "next/font/google";
import "./globals.css";

// Arcade cabinet, not magazine. Anton for the huge condensed impact type
// and the ghost rank numerals; Chakra Petch (angular, techy) for UI so
// nothing reads as default-Inter; DM Mono for every price and countdown.
const display = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});
const sans = Chakra_Petch({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
});
const mono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://playlocal.space"),
  title: "SuperSpot — Pay to be seen",
  description:
    "Claim a timed top spot on the internet's most honest leaderboard. Pay-to-feature spotlight inspired by Super Chat + Outbid, but your reign has a clock.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    // The card image itself comes from app/opengraph-image.png (Next's file
    // convention) — regenerate it with scripts/make-og.mjs.
    type: "website",
    url: "https://playlocal.space",
    siteName: "SuperSpot",
    title: "SuperSpot — Pay to be seen",
    description:
      "5 featured spots. Timed reigns. Steal the crown early if you dare. No accounts, just pay and paste your link.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SuperSpot — Pay to be seen",
    description: "5 featured spots. Timed reigns. Steal the crown early if you dare.",
  },
};

const THEME_INIT = `
try {
  var t = localStorage.getItem('superspot-theme');
  if (t === 'light') document.documentElement.classList.remove('dark');
  else document.documentElement.classList.add('dark');
} catch (e) { document.documentElement.classList.add('dark'); }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
