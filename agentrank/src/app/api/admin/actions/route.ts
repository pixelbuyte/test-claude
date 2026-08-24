import { NextRequest, NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  clearPlacements,
  DemoModeError,
  setListingCategory,
  setListingStatus,
} from "@/lib/db";
import { CATEGORIES } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  let body: { action?: string; id?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { action, id, category } = body;
  if (!id) {
    return NextResponse.json({ error: "Missing listing id." }, { status: 400 });
  }

  try {
    switch (action) {
      case "approve":
        await setListingStatus(id, "active");
        break;
      case "reject":
        // Clearing placements frees any permanent rank or tier slot the
        // listing held, so the position becomes sellable again immediately.
        await clearPlacements(id);
        await setListingStatus(id, "rejected");
        break;
      case "clear_placements":
        await clearPlacements(id);
        break;
      case "set_category":
        if (!CATEGORIES.some((c) => c.slug === category)) {
          return NextResponse.json({ error: "Unknown category." }, { status: 400 });
        }
        await setListingCategory(id, category!);
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DemoModeError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Admin action error", err);
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
