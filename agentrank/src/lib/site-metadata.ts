/**
 * Best-effort scrape of a site's title/description/logo so a buyer can list
 * their site with nothing but a URL. Always resolves — a slow site, a
 * non-HTML response, or unparseable markup all fall back to a clean guess
 * derived from the hostname rather than failing the purchase.
 */

import type { CategorySlug } from "@/lib/types";
import { deriveNameFromUrl, faviconUrl } from "@/lib/utils";

export interface SiteMetadata {
  name: string;
  description: string;
  logoUrl: string | null;
}

const FETCH_TIMEOUT_MS = 4500;
const MAX_HTML_CHARS = 200_000;

function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(base: string, maybeRelative: string): string | null {
  try {
    const resolved = new URL(maybeRelative, base);
    return resolved.protocol === "https:" || resolved.protocol === "http:"
      ? resolved.toString()
      : null;
  } catch {
    return null;
  }
}

const META_CONTENT = (prop: string, attr: "property" | "name") =>
  new RegExp(
    `<meta[^>]+${attr}=["']${prop}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
const META_CONTENT_REVERSED = (prop: string, attr: "property" | "name") =>
  new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${prop}["']`,
    "i",
  );

export async function fetchSiteMetadata(url: string): Promise<SiteMetadata> {
  const fallback: SiteMetadata = {
    name: deriveNameFromUrl(url),
    description: "",
    // Even when the page can't be fetched, the favicon service still gives
    // the listing a real logo — never a blank square.
    logoUrl: faviconUrl(url),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": `Mozilla/5.0 (compatible; URankBot/1.0; +${
          process.env.NEXT_PUBLIC_SITE_URL ?? "https://playlocal.space"
        }/rules)`,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok || !res.body) return fallback;
    if (!(res.headers.get("content-type") ?? "").includes("html")) {
      return fallback;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < MAX_HTML_CHARS) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});

    const finalUrl = res.url || url;
    const title =
      firstMatch(html, [
        META_CONTENT("og:title", "property"),
        META_CONTENT_REVERSED("og:title", "property"),
      ]) ?? firstMatch(html, [/<title[^>]*>([^<]+)<\/title>/i]);
    const description = firstMatch(html, [
      META_CONTENT("og:description", "property"),
      META_CONTENT_REVERSED("og:description", "property"),
      META_CONTENT("description", "name"),
      META_CONTENT_REVERSED("description", "name"),
    ]);
    // A site's own icon is used when we can find one (apple-touch-icon first
    // — it's the highest-resolution square a site publishes). og:image is
    // deliberately NOT used: it's a wide social banner and looks wrong
    // cropped into the board's small square logo slot.
    const iconHref =
      firstMatch(html, [
        /<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon(?:-precomposed)?["']/i,
      ]) ??
      firstMatch(html, [
        /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon)["']/i,
      ]);

    const name = (title ?? "").slice(0, 60).trim() || fallback.name;
    const trimmedDescription = (description ?? "").slice(0, 120);
    const logoUrl =
      (iconHref ? resolveUrl(finalUrl, iconHref) : null) ?? faviconUrl(finalUrl);

    return { name, description: trimmedDescription, logoUrl };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

const CATEGORY_KEYWORDS: [RegExp, CategorySlug][] = [
  [/\b(community|forum|discord|slack|meetup)\b/i, "communities"],
  [/\b(blog|newsletter|magazine|news|articles?)\b/i, "content"],
  [/\b(directory|marketplace|catalog|listings?)\b/i, "directories"],
  [/\bai\b|\bagents?\b|\bautomat(?:e|ion)\b|\bworkflow\b|\bchatbot\b|\bassistant\b|\bllm\b|\bgpt\b/i, "ai_automation"],
  [/\b(agency|consulting|studio|services|firm)\b/i, "business"],
];

/** Cheap keyword heuristic so auto-created listings don't all land in one
 * bucket — an admin can always correct it from the dashboard. */
export function guessCategory(name: string, description: string): CategorySlug {
  const text = `${name} ${description}`;
  for (const [pattern, slug] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return slug;
  }
  return "saas_tools";
}
