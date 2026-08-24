import { NextRequest, NextResponse } from "next/server";

import { createListing, DemoModeError, getActiveListings } from "@/lib/db";
import { CATEGORIES } from "@/lib/types";
import { normalizeUrl } from "@/lib/utils";

export const runtime = "nodejs";

/** Lightweight list used by the "upgrade an existing listing" picker. */
export async function GET() {
  try {
    const listings = await getActiveListings();
    return NextResponse.json({
      listings: listings.map((l) => ({ id: l.id, name: l.name, url: l.url })),
    });
  } catch (err) {
    console.error("Listings fetch error", err);
    return NextResponse.json({ error: "Could not load listings." }, { status: 500 });
  }
}

/** Free listing submission — goes to the open section only. */
export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    url?: string;
    description?: string;
    logoUrl?: string;
    category?: string;
    ownerEmail?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const url = normalizeUrl(body.url ?? "");
  const description = (body.description ?? "").trim();
  const logoUrl = body.logoUrl ? normalizeUrl(body.logoUrl) : null;
  const category =
    CATEGORIES.find((c) => c.slug === body.category)?.slug ?? "other";

  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Name must be 2–60 characters." },
      { status: 400 },
    );
  }
  if (!url) {
    return NextResponse.json(
      { error: "Enter a valid link — website, X, LinkedIn, YouTube, Discord…" },
      { status: 400 },
    );
  }
  if (description.length === 0 || description.length > 120) {
    return NextResponse.json(
      { error: "Description is required, 120 characters max." },
      { status: 400 },
    );
  }

  try {
    const listing = await createListing({
      name,
      url,
      description,
      logoUrl: logoUrl ?? undefined,
      category,
      ownerEmail: body.ownerEmail?.trim() || undefined,
    });
    return NextResponse.json({
      listing: { id: listing.id, status: listing.status },
    });
  } catch (err) {
    if (err instanceof DemoModeError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Listing create error", err);
    return NextResponse.json(
      { error: "Could not create the listing. Please try again." },
      { status: 500 },
    );
  }
}
