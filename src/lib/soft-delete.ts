import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTutorClaimWriteDb } from "#/lib/schedule-claims/claim-write-db";

export type SoftDeleteFields = {
  deleted_at: string;
  deleted_by: string;
  deletion_reason: string | null;
};

/** Patch for soft-deleting a row (retain for audit / compliance). */
export function softDeleteFields(
  actorId: string,
  reason?: string | null,
): SoftDeleteFields {
  return {
    deleted_at: new Date().toISOString(),
    deleted_by: actorId,
    deletion_reason: reason?.trim() || null,
  };
}

/** Clears soft-delete tombstone (restore). */
export function restoreSoftDeleteFields(): {
  deleted_at: null;
  deleted_by: null;
  deletion_reason: null;
} {
  return {
    deleted_at: null,
    deleted_by: null,
    deletion_reason: null,
  };
}

type Db = SupabaseClient;

/** Soft-delete DRAFT claims linked to a scheduled session. */
export async function softDeleteDraftClaimsForSession(
  db: Db,
  sessionId: string,
  actorId: string,
  reason?: string | null,
): Promise<void> {
  const patch = softDeleteFields(actorId, reason);
  const { error } = await db
    .from("session_claims")
    .update(patch)
    .eq("source_scheduled_session_id", sessionId)
    .eq("status", "DRAFT")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

/** Soft-delete attendance rows for a claim (session_id = claim id). */
export async function softDeleteAttendanceForClaim(
  db: Db,
  claimId: string,
  actorId: string,
  reason?: string | null,
): Promise<void> {
  const patch = softDeleteFields(actorId, reason);
  const { error } = await db
    .from("session_attendance")
    .update(patch)
    .eq("session_id", claimId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

/** Soft-delete a single claim and its attendance rows. */
export async function softDeleteClaim(
  db: Db,
  claimId: string,
  actorId: string,
  reason?: string | null,
): Promise<void> {
  const writeDb = await resolveTutorClaimWriteDb(db, actorId);
  await softDeleteAttendanceForClaim(writeDb, claimId, actorId, reason);
  const { error } = await writeDb
    .from("session_claims")
    .update(softDeleteFields(actorId, reason))
    .eq("id", claimId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

/** Soft-delete a scheduled session (row retained). */
export async function softDeleteScheduledSession(
  db: Db,
  sessionId: string,
  actorId: string,
  reason?: string | null,
): Promise<void> {
  const { error } = await db
    .from("scheduled_sessions")
    .update(softDeleteFields(actorId, reason))
    .eq("id", sessionId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

/**
 * Soft-delete active SCHEDULED occurrences before rematerializing a series.
 */
export async function softDeleteScheduledSessionsForRematerialize(
  db: Db,
  seriesId: string,
  actorId: string,
): Promise<void> {
  const patch = softDeleteFields(actorId, "Schedule republished");
  const { error } = await db
    .from("scheduled_sessions")
    .update(patch)
    .eq("series_id", seriesId)
    .eq("status", "SCHEDULED")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

/** Soft-delete draft series and its sessions (and draft claims). */
export async function softDeleteDraftScheduleSeries(
  db: Db,
  seriesId: string,
  actorId: string,
  reason?: string | null,
): Promise<void> {
  const patch = softDeleteFields(actorId, reason);

  const { data: sessions, error: sessErr } = await db
    .from("scheduled_sessions")
    .select("id")
    .eq("series_id", seriesId)
    .is("deleted_at", null);

  if (sessErr) throw new Error(sessErr.message);

  const sessionIds = (sessions ?? []).map((s) => s.id as string);

  for (const sessionId of sessionIds) {
    await softDeleteDraftClaimsForSession(db, sessionId, actorId, reason);
  }

  if (sessionIds.length > 0) {
    const { error: sessUpdErr } = await db
      .from("scheduled_sessions")
      .update(patch)
      .in("id", sessionIds);

    if (sessUpdErr) throw new Error(sessUpdErr.message);
  }

  const { error: seriesErr } = await db
    .from("schedule_series")
    .update(patch)
    .eq("id", seriesId)
    .is("deleted_at", null);

  if (seriesErr) throw new Error(seriesErr.message);
}
