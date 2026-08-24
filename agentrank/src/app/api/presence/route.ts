import { NextRequest, NextResponse } from "next/server";

import { getLiveVisitorCount, heartbeat } from "@/lib/db";

export const runtime = "nodejs";

/** Live visitor counter: distinct anonymous ids seen in the last 5 minutes. */
export async function GET() {
  try {
    const count = await getLiveVisitorCount();
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
