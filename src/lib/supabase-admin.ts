import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the **service role** key.
 * Bypasses RLS — use only inside server functions / API routes.
 *
 * Set `SUPABASE_SERVICE_ROLE_KEY` in `.env` (do **not** use the `VITE_` prefix).
 * Never import this module from client-only components.
 */
let cached: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const serviceKey =
    (typeof process !== "undefined" &&
      process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    undefined;

  if (!url || !serviceKey) {
    cached = null;
    return null;
  }

  cached = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}
