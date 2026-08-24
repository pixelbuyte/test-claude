import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "agentrank_admin";

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", process.env.ADMIN_PASSWORD ?? "")
    .update(`agentrank-admin-v2:${payload}`)
    .digest("hex");
}

/** Expiring session token: "<expiresAtMs>.<hmac>". The password itself never
 * lives in a cookie, and a stolen cookie stops working after the TTL. */
export function adminToken(now = Date.now()): string {
  const expiresAt = String(now + SESSION_TTL_MS);
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function passwordMatches(candidate: string): boolean {
  const expected = Buffer.from(process.env.ADMIN_PASSWORD ?? "");
  const given = Buffer.from(candidate);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value ?? "";
  const [expiresAt, mac] = value.split(".");
  if (!expiresAt || !mac) return false;
  if (!/^\d{1,16}$/.test(expiresAt) || Number(expiresAt) < Date.now()) {
    return false;
  }
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(expiresAt));
  return a.length === b.length && timingSafeEqual(a, b);
}
