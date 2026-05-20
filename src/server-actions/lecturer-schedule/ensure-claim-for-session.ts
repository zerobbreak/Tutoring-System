import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { ensureScheduledSessionClaim } from "#/lib/schedule-claims";

/** @deprecated Import from `#/lib/schedule-claims` — thin re-export for existing call sites. */
export async function ensureClaimForScheduledSession(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  scheduledSessionId: string,
): Promise<string> {
  return ensureScheduledSessionClaim(supabase, scheduledSessionId);
}
