import { NextRequest, NextResponse } from "next/server";

import {
  createListing,
  DemoModeError,
  findListingByUrl,
  getActiveListings,
} from "@/lib/db";
import { fetchSiteMetadata, guessCategory } from "@/lib/site-metadata";
import { CATEGORIES } from "@/lib/types";
import { isEmail, normalizeUrl } from "@/lib/utils";

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

  const url = normalizeUrl(body.url ?? "");
  if (!url) {
    return NextResponse.json(
      { error: "Enter a valid link — website, X, LinkedIn, YouTube, Discord…" },
      { status: 400 },
    );
  }

  const ownerEmail = body.ownerEmail?.trim();
  if (ownerEmail && !isEmail(ownerEmail)) {
    return NextResponse.json(
      { error: "That email address doesn't look valid." },
      { status: 400 },
    );
  }

  // Everything but the URL is optional: name, description, logo and category
  // are scraped from the site so listing is a one-field action. Any field the
  // caller does supply wins over the scraped value.
  const overrideName = (body.name ?? "").trim();
  const overrideDescription = (body.description ?? "").trim();
  const overrideLogo = body.logoUrl ? normalizeUrl(body.logoUrl) : null;
  const overrideCategory = CATEGORIES.find((c) => c.slug === body.category)?.slug;

  if (overrideName && (overrideName.length < 2 || overrideName.length > 60)) {
    return NextResponse.json(
      { error: "Name must be 2–60 characters." },
      { status: 400 },
    );
  }
  if (overrideDescription.length > 120) {
    return NextResponse.json(
      { error: "Description must be 120 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const existing = await findListingByUrl(url);
    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.status === "rejected"
              ? "This site can't be listed."
              : "That site is already on the board.",
        },
        { status: 409 },
      );
    }

    const meta = await fetchSiteMetadata(url);
    const name = overrideName || meta.name;
    const description = overrideDescription || meta.description;
    const listing = await createListing({
      name,
      url,
      description,
      logoUrl: overrideLogo ?? meta.logoUrl ?? undefined,
      category: overrideCategory ?? guessCategory(name, description),
      ownerEmail: ownerEmail || undefined,
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
