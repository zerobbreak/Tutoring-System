import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "./supabase-env";

/**
 * Browser Supabase client (PKCE + cookie-backed session via `@supabase/ssr`).
 * Use only in client components / effects — never import from server-only code.
 */
export const supabase = createBrowserClient(
  getSupabaseUrl(),
  getSupabaseAnonKey(),
  {
    auth: {
      detectSessionInUrl: true,
    },
  },
);
