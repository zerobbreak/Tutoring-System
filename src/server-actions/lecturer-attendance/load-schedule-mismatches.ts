import type { SupabaseClient } from "@supabase/supabase-js";
import {
  claimSnapshotFromScheduledSession,
  diffClaimFromSnapshot,
  type ScheduledSessionForClaim,
} from "#/lib/schedule-claims";
import { normalizeSupabaseNestedRow } from "#/lib/supabase-nested-row";
import type { ScheduleMismatchRow } from "./build-integrity-issues";

function toScheduledSessionForClaim(
  scheduled: Record<string, unknown>,
): ScheduledSessionForClaim {
  const venue = normalizeSupabaseNestedRow(
    scheduled.venue as { name: string } | { name: string }[] | null,
  );
  const series = normalizeSupabaseNestedRow(
    scheduled.series as
      | { session_kind: string }
      | { session_kind: string }[]
      | null,
  );
  return {
    id: scheduled.id as string,
    module_id: scheduled.module_id as string,
    tutor_id: scheduled.tutor_id as string,
    starts_at: scheduled.starts_at as string,
    ends_at: scheduled.ends_at as string,
    venue_text: (scheduled.venue_text as string | null) ?? null,
    venue,
    series,
  };
}

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
    const scheduledRaw = normalizeSupabaseNestedRow(
      row.scheduled as Record<string, unknown> | Record<string, unknown>[] | null,
    );
    if (!scheduledRaw?.starts_at || !scheduledRaw?.ends_at) continue;

    const snapshot = claimSnapshotFromScheduledSession(
      toScheduledSessionForClaim(scheduledRaw),
    );
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

    const mod = normalizeSupabaseNestedRow(
      row.module as { code: string } | { code: string }[] | null,
    );
    const moduleCode = mod?.code ?? "—";

    out.push({
      claimId: row.id as string,
      moduleCode,
      session_date: row.session_date as string,
      message: `${moduleCode} on ${row.session_date}: claim differs from schedule (${mismatches.join(", ")}).`,
    });
  }

  return out;
}
