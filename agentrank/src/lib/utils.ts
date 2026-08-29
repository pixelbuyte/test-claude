import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalizes a user-supplied link: allows bare domains and social handles. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Light-touch email shape check for an optional field — not RFC-complete. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
}

/** Turns a URL into a clean fallback display name, e.g.
 * "https://www.acme-ai.com/product" -> "Acme Ai". Used when metadata
 * scraping can't find a real title. */
/** Bare domain for display — "https://www.skinstel.com/x" -> "skinstel.com". */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function deriveNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] || host;
    const words = label
      .split(/[-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    return words.length ? words.join(" ") : host;
  } catch {
    return url;
  }
}

/**
 * Favicon URL for any site, derived purely from its address — no scraping,
 * no upload, works client-side the moment someone types a URL. Google's
 * service always returns an image (a generic globe when a site has no icon),
 * so a listing is never left without a logo.
 */
export function faviconUrl(url: string, size = 128): string | null {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
  } catch {
    return null;
  }
}

/**
 * Normalizes a URL down to a dedup key (host without "www.", path without a
 * trailing slash, query/hash dropped, lowercased) so buying a placement for
 * a URL that's already listed finds and upgrades it instead of creating a
 * duplicate. Matches the `url_key` generated column in supabase/schema.sql —
 * keep the two in sync. Not a security boundary, just fuzzy matching.
 */
export function urlMatchKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function timeLeft(expiresAtIso: string, now: Date): string {
  const ms = new Date(expiresAtIso).getTime() - now.getTime();
  if (ms <= 0) return "expired";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
