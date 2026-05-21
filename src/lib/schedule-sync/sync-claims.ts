import type { SupabaseClient } from "@supabase/supabase-js";
import { diffClaimFromSnapshot } from "#/lib/schedule-claims/diff-claim-from-snapshot";
import { ensureScheduledSessionClaim } from "#/lib/schedule-claims/ensure-scheduled-session-claim";
import type { ClaimSnapshot } from "#/lib/schedule-claims/types";
import { logInstitutionAudit } from "#/lib/audit-log";
import type { ScheduleSyncEvent } from "#/lib/schedule-sync/types";
import {
  lockClaimAttendanceAndInvalidateQr,
  refreshClaimQrForSchedule,
  unlockClaimAttendanceIfCancelledOnly,
} from "#/lib/schedule-sync/effects/attendance-qr";

type LinkedClaim = {
  id: string;
  status: string;
  frozen_at: string | null;
  tutor_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number | string | null;
  venue: string | null;
};

const MUTABLE_STATUSES = new Set(["DRAFT", "PENDING_VERIFICATION"]);

async function loadLinkedClaim(
  db: SupabaseClient,
  scheduledSessionId: string,
): Promise<LinkedClaim | null> {
  const { data, error } = await db
    .from("session_claims")
    .select(
      "id, status, frozen_at, tutor_id, session_date, start_time, end_time, hours, venue",
    )
    .eq("source_scheduled_session_id", scheduledSessionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as LinkedClaim | null;
}

async function applySnapshotToClaim(
  db: SupabaseClient,
  claimId: string,
  snapshot: ClaimSnapshot,
  options: { includeTutor: boolean },
): Promise<void> {
  const patch: Record<string, unknown> = {
    session_date: snapshot.session_date,
    start_time: snapshot.start_time,
    end_time: snapshot.end_time,
    hours: snapshot.hours,
    venue: snapshot.venue,
    module_id: snapshot.module_id,
    session_kind: snapshot.session_kind,
  };
  if (options.includeTutor) {
    patch.tutor_id = snapshot.tutor_id;
  }

  const { error } = await db
    .from("session_claims")
    .update(patch)
    .eq("id", claimId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

async function logSkippedClaimSync(
  db: SupabaseClient,
  event: ScheduleSyncEvent,
  claimId: string,
  reason: string,
): Promise<void> {
  await logInstitutionAudit(db, {
    institutionId: event.institutionId,
    actorId: event.actorId,
    entityType: "SESSION_CLAIM",
    entityId: claimId,
    event: "SCHEDULE_SYNC_SKIPPED_FROZEN_CLAIM",
    payload: {
      scheduledSessionId: event.scheduledSessionId,
      syncEvent: event.type,
      reason,
    },
  });
}

export type SyncClaimsResult = {
  claimId: string | null;
  skippedClaimSync: boolean;
  mismatches: string[];
};

/** Apply schedule snapshot to linked session_claim per status policy. */
export async function syncSessionClaimsFromSchedule(
  db: SupabaseClient,
  event: ScheduleSyncEvent,
): Promise<SyncClaimsResult> {
  const snapshot = event.after.claimSnapshot;
  const mismatches: string[] = [];

  if (event.after.status === "CANCELLED") {
    let claim = await loadLinkedClaim(db, event.scheduledSessionId);
    if (!claim) {
      return { claimId: null, skippedClaimSync: false, mismatches };
    }
    await lockClaimAttendanceAndInvalidateQr(db, claim.id);
    return { claimId: claim.id, skippedClaimSync: false, mismatches };
  }

  if (event.type === "SESSION_RESTORED") {
    let claim = await loadLinkedClaim(db, event.scheduledSessionId);
    if (!claim) {
      const claimId = await ensureScheduledSessionClaim(
        db,
        event.scheduledSessionId,
      );
      claim = await loadLinkedClaim(db, event.scheduledSessionId);
      if (claim) {
        await unlockClaimAttendanceIfCancelledOnly(db, claim.id);
        await refreshClaimQrForSchedule(db, claim.id);
      }
      return { claimId: claim?.id ?? claimId, skippedClaimSync: false, mismatches };
    }
    await unlockClaimAttendanceIfCancelledOnly(db, claim.id);
    if (claim.status === "DRAFT" && !claim.frozen_at) {
      await applySnapshotToClaim(db, claim.id, snapshot, { includeTutor: true });
    }
    await refreshClaimQrForSchedule(db, claim.id);
    return { claimId: claim.id, skippedClaimSync: false, mismatches };
  }

  let claim = await loadLinkedClaim(db, event.scheduledSessionId);
  if (!claim) {
    const claimId = await ensureScheduledSessionClaim(
      db,
      event.scheduledSessionId,
    );
    return { claimId, skippedClaimSync: false, mismatches };
  }

  if (claim.frozen_at) {
    await logSkippedClaimSync(db, event, claim.id, "claim_frozen");
    return { claimId: claim.id, skippedClaimSync: true, mismatches };
  }

  if (!MUTABLE_STATUSES.has(claim.status)) {
    const diff = diffClaimFromSnapshot(
      {
        session_date: claim.session_date,
        start_time: claim.start_time ?? "",
        end_time: claim.end_time ?? "",
        hours: claim.hours,
        venue: claim.venue,
      },
      snapshot,
    );
    if (diff.length) {
      mismatches.push(...diff);
      await logSkippedClaimSync(
        db,
        event,
        claim.id,
        `status_${claim.status}`,
      );
    }
    return { claimId: claim.id, skippedClaimSync: true, mismatches };
  }

  const includeTutor =
    event.type === "TUTOR_REASSIGNED" && claim.status === "DRAFT";

  if (
    event.type === "SESSION_TIME_CHANGED" ||
    event.type === "VENUE_CHANGED" ||
    event.type === "TUTOR_REASSIGNED"
  ) {
    await applySnapshotToClaim(db, claim.id, snapshot, { includeTutor });
  }

  if (event.type === "SESSION_TIME_CHANGED" || event.type === "SESSION_RESTORED") {
    await refreshClaimQrForSchedule(db, claim.id);
  }

  return { claimId: claim.id, skippedClaimSync: false, mismatches };
}
