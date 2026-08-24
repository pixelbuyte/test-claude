import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "agentrank_admin";

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** Deterministic session token derived from the admin password, so the
 * password itself never lives in a cookie. */
export function adminToken(): string {
  return createHmac("sha256", process.env.ADMIN_PASSWORD ?? "")
    .update("agentrank-admin-v1")
    .digest("hex");
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
  const expected = adminToken();
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
