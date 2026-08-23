import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

// GET /api/og?url=https://example.com
// Fetches basic Open Graph metadata so listings auto-populate a
// title/description/image/favicon without the submitter typing anything.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
    if (!/^https?:$/.test(target.protocol)) throw new Error("bad protocol");
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const domain = target.hostname;
  const fallback = {
    title: domain,
    description: "",
    image: null as string | null,
    favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  };

  try {
    const res = await fetch(target.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SuperSpotBot/1.0)" },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const pick = (selectors: string[]) => {
      for (const sel of selectors) {
        const v = $(sel).attr("content");
        if (v) return v;
      }
      return null;
    };

    const title =
      pick(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
      $("title").first().text() ||
      fallback.title;

    const description =
      pick([
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        'meta[name="description"]',
      ]) || "";

    let image = pick(['meta[property="og:image"]', 'meta[name="twitter:image"]']);
    if (image && !/^https?:\/\//.test(image)) {
      image = new URL(image, target.origin).toString();
    }

    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      null;
    if (favicon && !/^https?:\/\//.test(favicon)) {
      favicon = new URL(favicon, target.origin).toString();
    }

    return NextResponse.json({
      title: title.trim().slice(0, 120),
      description: description.trim().slice(0, 220),
      image,
      favicon: favicon || fallback.favicon,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
