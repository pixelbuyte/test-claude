import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
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
    <html lang="en" className="dark">
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
