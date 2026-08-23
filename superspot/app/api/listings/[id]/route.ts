import { NextRequest, NextResponse } from "next/server";
import { recordClick } from "@/lib/db";

// POST /api/listings/:id — increments the public click counter.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const listing = recordClick(params.id);
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ clicks: listing.clicks });
}
