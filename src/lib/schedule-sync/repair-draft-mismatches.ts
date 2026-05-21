import type { SupabaseClient } from "@supabase/supabase-js";
import { claimSnapshotFromScheduledSession } from "#/lib/schedule-claims/claim-snapshot";
import { diffClaimFromSnapshot } from "#/lib/schedule-claims/diff-claim-from-snapshot";
import type { ScheduledSessionForClaim } from "#/lib/schedule-claims/types";
import { logInstitutionAudit } from "#/lib/audit-log";

export type RepairDraftMismatchesResult = {
  repaired: number;
  skipped: number;
};

/** Auto-align DRAFT claims with their linked scheduled_sessions row. */
export async function repairDraftClaimScheduleMismatches(
  db: SupabaseClient,
  institutionId: string,
  actorId: string | null,
): Promise<RepairDraftMismatchesResult> {
  const { data: rows, error } = await db
    .from("session_claims")
    .select(
      `
      id,
      status,
      frozen_at,
      session_date,
      start_time,
      end_time,
      hours,
      venue,
      source_scheduled_session_id,
      module:modules ( institution_id ),
      scheduled:scheduled_sessions (
        id,
        module_id,
        tutor_id,
        starts_at,
        ends_at,
        venue_text,
        status,
        venue:venues ( name ),
        series:schedule_series ( session_kind )
      )
    `,
    )
    .eq("status", "DRAFT")
    .is("frozen_at", null)
    .is("deleted_at", null)
    .not("source_scheduled_session_id", "is", null);

  if (error) throw new Error(error.message);

  let repaired = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const modRaw = row.module;
    const mod = Array.isArray(modRaw) ? modRaw[0] : modRaw;
    if ((mod as { institution_id: string } | null)?.institution_id !== institutionId) {
      continue;
    }

    const scheduledRaw = row.scheduled;
    const scheduled = Array.isArray(scheduledRaw)
      ? scheduledRaw[0]
      : scheduledRaw;
    if (!scheduled || (scheduled as { status: string }).status === "CANCELLED") {
      skipped += 1;
      continue;
    }

    const session = scheduled as unknown as ScheduledSessionForClaim;
    const snapshot = claimSnapshotFromScheduledSession(session);
    const mismatches = diffClaimFromSnapshot(
      {
        session_date: row.session_date as string,
        start_time: row.start_time as string,
        end_time: row.end_time as string,
        hours: row.hours,
        venue: row.venue as string | null,
      },
      snapshot,
    );

    if (!mismatches.length) continue;

    const { error: upErr } = await db
      .from("session_claims")
      .update({
        session_date: snapshot.session_date,
        start_time: snapshot.start_time,
        end_time: snapshot.end_time,
        hours: snapshot.hours,
        venue: snapshot.venue,
        tutor_id: snapshot.tutor_id,
        module_id: snapshot.module_id,
        session_kind: snapshot.session_kind,
      })
      .eq("id", row.id as string);

    if (upErr) {
      skipped += 1;
      continue;
    }

    repaired += 1;
    await logInstitutionAudit(db, {
      institutionId,
      actorId,
      entityType: "SESSION_CLAIM",
      entityId: row.id as string,
      event: "SCHEDULE_SYNC_DRAFT_REPAIRED",
      payload: {
        scheduledSessionId: row.source_scheduled_session_id,
        fields: mismatches,
      },
    });
  }

  return { repaired, skipped };
}
