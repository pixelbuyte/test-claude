import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

// These settings decide what everyone is charged, so writes are gated behind
// ADMIN_PASSWORD. This FAILS CLOSED: with no password configured, nobody can
// change pricing — an unset secret must never mean "open to the world".
function authorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;

  const supplied = req.headers.get("x-admin-password") ?? "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return a.length === b.length && timingSafeEqual(a, b);
}

// Reads are public: these numbers are already visible as prices on the board.
export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      {
        error: process.env.ADMIN_PASSWORD
          ? "Wrong admin password."
          : "ADMIN_PASSWORD is not set on this deployment, so settings are locked.",
      },
      { status: 401 }
    );
  }

  const body = await req.json();
  const updated = updateSettings(body);
  return NextResponse.json(updated);
}
