import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ThemeProvider } from "@/components/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Without a base, Next cannot make OG/canonical URLs absolute and warns at
  // build time. The env var wins so previews describe themselves correctly.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://playlocal.space",
  ),
  title: {
    default: "URank — the fixed-price leaderboard for any site",
    template: "%s · URank",
  },
  description:
    "A transparent, fixed-price public ranking board for any website or tool. No auctions, no outbidding — permanent slots and timed tier placements at clear prices.",
  // Without these the page shares as a bare link: X had no image, no card
  // type and nothing but the <title> to show. opengraph-image.tsx supplies
  // the picture; summary_large_image is what makes X draw the wide card
  // rather than a thumbnail. Twitter inherits the OG image when twitter.images
  // is left unset, so the image is declared once.
  openGraph: {
    type: "website",
    siteName: "URank",
    url: "/",
    title: "URank — the fixed-price leaderboard for any site",
    description:
      "Fixed prices, fixed durations, no auctions. Own a permanent rank or rent a timed spot — every price published up front.",
  },
  twitter: {
    card: "summary_large_image",
    title: "URank — the fixed-price leaderboard for any site",
    description:
      "Fixed prices, fixed durations, no auctions. Own a permanent rank or rent a timed spot — every price published up front.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
