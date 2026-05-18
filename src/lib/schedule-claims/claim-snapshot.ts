import { scheduleClaimTimesFromTimestamps } from "#/lib/schedule-claim-times";
import { creationSourceForSessionKind } from "./creation-source-for-session-kind";
import type { ClaimSnapshot, ScheduledSessionForClaim } from "./types";

export function resolveScheduledVenue(row: {
  venue_text: string | null;
  venue: { name: string } | null;
}): string | null {
  return row.venue_text?.trim() || row.venue?.name?.trim() || null;
}

/** Canonical claim fields derived from a scheduled occurrence. */
export function claimSnapshotFromScheduledSession(
  row: ScheduledSessionForClaim,
): ClaimSnapshot {
  const startsAt = new Date(row.starts_at);
  const endsAt = new Date(row.ends_at);
  const times = scheduleClaimTimesFromTimestamps(startsAt, endsAt);
  const sessionKind = row.series?.session_kind ?? "tutorial";

  return {
    tutor_id: row.tutor_id,
    module_id: row.module_id,
    session_date: times.session_date,
    start_time: times.start_time,
    end_time: times.end_time,
    hours: times.hours,
    venue: resolveScheduledVenue(row),
    session_kind: sessionKind,
    creation_source: creationSourceForSessionKind(sessionKind),
    source_scheduled_session_id: row.id,
  };
}
