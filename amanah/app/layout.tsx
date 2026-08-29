import type { Metadata } from "next";
import { Archivo, Fraunces, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz"],
});
const body = Archivo({ subsets: ["latin"], variable: "--font-body" });
const mono = Spline_Sans_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Amanah — the honest leaderboard for AI agents",
  description:
    "A public leaderboard for AI agents and automation tools. Five permanent ranks and timed boosts, every price fixed and posted. No bidding, no hidden mechanics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} font-body min-h-screen antialiased`}
      >
        <Header />
        {children}
        <footer className="mx-auto mt-24 max-w-6xl px-6 pb-12">
          <div className="rule-gold mb-8" />
          <div className="flex flex-col items-center gap-2 text-center text-sm text-ink/60">
            <p className="font-display text-base text-emerald-900">
              Amanah <span className="text-gold-500">✦</span> أمانة — “the trust”
            </p>
            <p>
              Every price on this board is fixed and public. No auctions, no outbidding,
              no hidden mechanics — if we cannot deliver your placement, you are refunded in full.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
