import type { SupabaseClient } from "@supabase/supabase-js";
import {
  claimSnapshotFromScheduledSession,
  diffClaimFromSnapshot,
  type ScheduledSessionForClaim,
} from "#/lib/schedule-claims";
import type { ScheduleMismatchRow } from "./build-integrity-issues";

export async function loadScheduleMismatches(
  db: SupabaseClient,
  claimIds: string[],
): Promise<ScheduleMismatchRow[]> {
  if (!claimIds.length) return [];

  const { data: rows, error } = await db
    .from("session_claims")
    .select(
      `
      id,
      session_date,
      start_time,
      end_time,
      hours,
      venue,
      source_scheduled_session_id,
      module:modules ( code ),
      scheduled:scheduled_sessions (
        id,
        module_id,
        tutor_id,
        starts_at,
        ends_at,
        venue_text,
        venue:venues ( name ),
        series:schedule_series ( session_kind )
      )
    `,
    )
    .in("id", claimIds)
    .not("source_scheduled_session_id", "is", null)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const out: ScheduleMismatchRow[] = [];

  for (const row of rows ?? []) {
    const scheduled = row.scheduled as ScheduledSessionForClaim | null;
    if (!scheduled?.starts_at || !scheduled?.ends_at) continue;

    const snapshot = claimSnapshotFromScheduledSession(scheduled);
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

    const mod = Array.isArray(row.module) ? row.module[0] : row.module;
    const moduleCode = (mod as { code: string } | null)?.code ?? "—";

    out.push({
      claimId: row.id as string,
      moduleCode,
      session_date: row.session_date as string,
      message: `${moduleCode} on ${row.session_date}: claim differs from schedule (${mismatches.join(", ")}).`,
    });
  }

  return out;
}
