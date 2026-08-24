import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * All database access goes through the server with the service-role key —
 * the browser never talks to Supabase directly. Row Level Security stays
 * enabled as defense in depth (see supabase/schema.sql).
 */

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

let adminClient: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!isDbConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return adminClient;
}
