import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureScheduledSessionClaim } from "./ensure-scheduled-session-claim";

export type ReconcileSeriesClaimsResult = {
  ensured: number;
  skipped: number;
};

export type ReconcileSeriesClaimsOptions = {
  /** When true, do not ensure claims for CANCELLED occurrences (default true). */
  skipCancelled?: boolean;
};

/** Ensure every active scheduled occurrence in the series has an aligned DRAFT claim. */
export async function reconcileSeriesClaims(
  db: SupabaseClient,
  seriesId: string,
  options?: ReconcileSeriesClaimsOptions,
): Promise<ReconcileSeriesClaimsResult> {
  const skipCancelled = options?.skipCancelled !== false;

  let query = db
    .from("scheduled_sessions")
    .select("id, status")
    .eq("series_id", seriesId)
    .is("deleted_at", null);

  if (skipCancelled) {
    query = query.neq("status", "CANCELLED");
  }

  const { data: sessions, error } = await query;

  if (error) throw new Error(error.message);

  let ensured = 0;
  let skipped = 0;

  for (const s of sessions ?? []) {
    if (skipCancelled && s.status === "CANCELLED") {
      skipped += 1;
      continue;
    }
    await ensureScheduledSessionClaim(db, s.id as string);
    ensured += 1;
  }

  return { ensured, skipped };
}
