import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Editorial serif for display, grotesk for UI, mono for every numeral.
// The mono/serif pairing is what keeps this from reading as a default
// Tailwind template.
const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://playlocal.space"),
  title: "SuperSpot — Pay to be seen",
  description:
    "Claim a timed top spot on the internet's most honest leaderboard. Pay-to-feature spotlight inspired by Super Chat + Outbid, but your reign has a clock.",
  openGraph: {
    title: "SuperSpot — Pay to be seen",
    description:
      "5 featured spots. Timed reigns. Steal the crown early if you dare. No accounts, just pay and paste your link.",
    type: "website",
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
      className={`dark ${sans.variable} ${serif.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
