import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db";

// NOTE: this demo has no auth gate on /admin — add one (e.g. a password
// cookie or Supabase Auth) before deploying somewhere public.
export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const updated = updateSettings(body);
  return NextResponse.json(updated);
}
