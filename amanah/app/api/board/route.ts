import { NextResponse } from "next/server";
import { boardState } from "@/lib/db";
import { demoMode } from "@/lib/stripe";
import { BoardPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = boardState();
  const payload: BoardPayload = { ...state, demoMode: demoMode() };
  return NextResponse.json(payload);
}
