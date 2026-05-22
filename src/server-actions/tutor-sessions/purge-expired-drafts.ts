import type { SupabaseClient } from "@supabase/supabase-js";
import { isSessionEnded, type SessionClaimTimingFields } from "#/lib/session-claim-lifecycle";
import { softDeleteClaim } from "#/lib/soft-delete";

export const DRAFT_EXPIRED_PURGED_ACTION = "DRAFT_EXPIRED_PURGED";

type DraftRow = SessionClaimTimingFields & {
  id: string;
  tutor_id: string;
  venue: string | null;
  hours: number | string;
  module: { code: string; name: string; institution_id: string } | null;
};

/**
 * Soft-deletes tutor DRAFT claims whose session end is in the past. Writes a
 * verification_actions row before discard so institutions keep an audit trail.
 */
export async function purgeExpiredDraftClaimsForTutor(
  db: SupabaseClient,
  tutorId: string,
): Promise<number> {
  const now = new Date();

  const { data: rows, error } = await db
    .from("session_claims")
    .select(
      `
      id,
      tutor_id,
      session_date,
      start_time,
      end_time,
      hours,
      venue,
      module:modules ( code, name, institution_id )
    `,
    )
    .eq("tutor_id", tutorId)
    .eq("status", "DRAFT")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const expired = (rows ?? []).filter((r) =>
    isSessionEnded(r as SessionClaimTimingFields, now),
  ) as DraftRow[];

  if (!expired.length) return 0;

  for (const row of expired) {
    const mod = Array.isArray(row.module) ? row.module[0] : row.module;
    const snapshot = {
      session_date: row.session_date,
      start_time: row.start_time,
      end_time: row.end_time,
      hours: row.hours,
      venue: row.venue,
      module_code: mod?.code ?? null,
      module_name: mod?.name ?? null,
      purged_at: now.toISOString(),
    };

    const { error: logErr } = await db.from("verification_actions").insert({
      claim_id: row.id,
      actor_id: tutorId,
      action_type: DRAFT_EXPIRED_PURGED_ACTION,
      from_status: "DRAFT",
      to_status: null,
      comment: JSON.stringify(snapshot),
    });

    if (logErr) throw new Error(logErr.message);
  }

  for (const row of expired) {
    await softDeleteClaim(db, row.id, tutorId, "Expired draft purged");
  }

  return expired.length;
}
