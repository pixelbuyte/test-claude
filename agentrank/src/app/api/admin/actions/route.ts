import { NextRequest, NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  clearPlacements,
  DemoModeError,
  setListingStatus,
} from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  let body: { action?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { action, id } = body;
  if (!id) {
    return NextResponse.json({ error: "Missing listing id." }, { status: 400 });
  }

  try {
    switch (action) {
      case "approve":
        await setListingStatus(id, "active");
        break;
      case "reject":
        await setListingStatus(id, "rejected");
        break;
      case "clear_placements":
        await clearPlacements(id);
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
