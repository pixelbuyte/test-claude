import { NextRequest, NextResponse } from "next/server";

import { getDisplayVisitorCount, heartbeat } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Live visitor counter: distinct anonymous ids seen in the last 5 minutes,
 * plus the starter baseline while the board is still bootstrap content.
 *
 * Must return the same number the page rendered — this is the value the
 * client poll writes over the server-rendered one. Using the raw count here
 * is what made the counter fall from ~120 to 1 a second after load.
 */
export async function GET() {
  try {
    const count = await getDisplayVisitorCount();
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { anonId?: string };
    const anonId = (body.anonId ?? "").slice(0, 64);
    if (/^[a-zA-Z0-9_-]{8,64}$/.test(anonId)) {
      await heartbeat(anonId);
    }
  } catch {
    // Presence is best-effort; never surface errors to the client.
  }
  return NextResponse.json({ ok: true });
}
