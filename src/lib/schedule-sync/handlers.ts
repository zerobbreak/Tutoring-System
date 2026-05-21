import type { SupabaseClient } from "@supabase/supabase-js";
import { logInstitutionAudit } from "#/lib/audit-log";
import { classifyScheduleChange } from "#/lib/schedule-sync/classify-change";
import { notifyScheduleSyncRecipients } from "#/lib/schedule-sync/notify";
import { loadScheduledSessionSnapshot } from "#/lib/schedule-sync/snapshot";
import { syncSessionClaimsFromSchedule } from "#/lib/schedule-sync/sync-claims";
import type {
  ScheduleSyncEvent,
  ScheduledSessionSnapshot,
} from "#/lib/schedule-sync/types";

async function logScheduleSyncAudit(
  db: SupabaseClient,
  event: ScheduleSyncEvent,
  claimId: string | null,
  extra?: Record<string, unknown>,
): Promise<void> {
  await logInstitutionAudit(db, {
    institutionId: event.institutionId,
    actorId: event.actorId,
    entityType: "SCHEDULED_SESSION",
    entityId: event.scheduledSessionId,
    event: event.type,
    payload: {
      claimId,
      moduleId: event.after.moduleId,
      ...extra,
    },
  });
}

async function handleScheduleSyncEvent(
  db: SupabaseClient,
  event: ScheduleSyncEvent,
): Promise<void> {
  const claimResult = await syncSessionClaimsFromSchedule(db, event);
  await notifyScheduleSyncRecipients(db, event, claimResult.claimId);
  await logScheduleSyncAudit(db, event, claimResult.claimId, {
    skippedClaimSync: claimResult.skippedClaimSync,
    mismatches: claimResult.mismatches,
  });
}

/** Run all schedule sync side effects for the given events. */
export async function emitScheduleSyncEvents(
  db: SupabaseClient,
  events: ScheduleSyncEvent[],
): Promise<void> {
  for (const event of events) {
    await handleScheduleSyncEvent(db, event);
  }
}

/** Load after snapshot, classify, and emit — convenience after DB update. */
export async function syncScheduledSessionAfterUpdate(
  db: SupabaseClient,
  input: {
    scheduledSessionId: string;
    actorId: string;
    before: ScheduledSessionSnapshot | null;
  },
): Promise<void> {
  const after = await loadScheduledSessionSnapshot(
    db,
    input.scheduledSessionId,
  );
  if (!after) return;

  const events = classifyScheduleChange({
    actorId: input.actorId,
    before: input.before,
    after,
  });

  if (!events.length) return;
  await emitScheduleSyncEvents(db, events);
}
