import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * All database access goes through the server with the service-role key —
 * the browser never talks to Supabase directly. Row Level Security stays
 * enabled as defense in depth (see supabase/schema.sql).
 */

/**
 * The project URL, under either name it can arrive as.
 *
 * .env.example asks for NEXT_PUBLIC_SUPABASE_URL, but Vercel's own Supabase
 * integration provisions SUPABASE_URL. Reading only the first leaves a
 * correctly-connected project sitting in demo mode with nothing on screen
 * explaining why. Everything here runs on the server, so the non-public name
 * is fine to read.
 */
function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

export function isDbConfigured(): boolean {
  return Boolean(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let adminClient: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!isDbConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  if (!adminClient) {
    adminClient = createClient(
      supabaseUrl()!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return adminClient;
}
