import { NextRequest, NextResponse } from "next/server";

import { incrementClick } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Public click tracking: /go/<listing-id> atomically increments the listing's
 * real outbound click count and redirects to its URL.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const url = await incrementClick(id);
    if (url) {
      return NextResponse.redirect(url, { status: 302 });
    }
  } catch (err) {
    console.error("Click tracking error", err);
  }
  return NextResponse.redirect(new URL("/", _req.url), { status: 302 });
}
