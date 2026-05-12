import { createServerClient } from "@supabase/ssr";
import {
  getCookies,
  setCookie,
  setResponseHeader,
} from "@tanstack/react-start/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "./supabase-env";

/**
 * Per-request Supabase client: reads/writes auth cookies on the TanStack Start
 * server (see Supabase SSR guide). Do not cache or share across requests.
 */
export function createSupabaseServerClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        try {
          const jar = getCookies();
          return Object.entries(jar).map(([name, value]) => ({ name, value }));
        } catch {
          return [];
        }
      },
      setAll(cookiesToSet, responseHeaders) {
        try {
          for (const c of cookiesToSet) {
            setCookie(c.name, c.value, c.options);
          }
          if (responseHeaders) {
            for (const [name, value] of Object.entries(responseHeaders)) {
              setResponseHeader(
                name as Parameters<typeof setResponseHeader>[0],
                value,
              );
            }
          }
        } catch {
          /* No H3 request context (e.g. tooling) — cookies cannot be applied */
        }
      },
    },
  });
}
