import type { SupabaseClient } from "@supabase/supabase-js";
import { claimSnapshotFromScheduledSession } from "#/lib/schedule-claims/claim-snapshot";
import type { ScheduledSessionForClaim } from "#/lib/schedule-claims/types";
import type { ScheduledSessionSnapshot } from "#/lib/schedule-sync/types";

const SESSION_SELECT = `
  id,
  module_id,
  tutor_id,
  starts_at,
  ends_at,
  venue_id,
  venue_text,
  status,
  venue:venues ( name ),
  series:schedule_series ( session_kind ),
  module:modules (
    id,
    code,
    name,
    institution_id,
    lecturer_id
  )
`;

function normalizeScheduledRow(raw: Record<string, unknown>): ScheduledSessionForClaim & {
  status: string;
  venue_id: string | null;
} {
  const venueRaw = raw.venue;
  const venue = Array.isArray(venueRaw) ? venueRaw[0] : venueRaw;
  const seriesRaw = raw.series;
  const series = Array.isArray(seriesRaw) ? seriesRaw[0] : seriesRaw;

  return {
    id: raw.id as string,
    module_id: raw.module_id as string,
    tutor_id: raw.tutor_id as string,
    starts_at: raw.starts_at as string,
    ends_at: raw.ends_at as string,
    venue_text: (raw.venue_text as string | null) ?? null,
    venue_id: (raw.venue_id as string | null) ?? null,
    status: raw.status as string,
    venue: venue as { name: string } | null,
    series: series as { session_kind: string } | null,
  };
}

/** Load a scheduled occurrence with institution + claim snapshot fields. */
export async function loadScheduledSessionSnapshot(
  db: SupabaseClient,
  scheduledSessionId: string,
): Promise<ScheduledSessionSnapshot | null> {
  const { data, error } = await db
    .from("scheduled_sessions")
    .select(SESSION_SELECT)
    .eq("id", scheduledSessionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = normalizeScheduledRow(data as Record<string, unknown>);
  const modRaw = (data as { module: unknown }).module;
  const mod = Array.isArray(modRaw) ? modRaw[0] : modRaw;
  const module = mod as {
    id: string;
    code: string;
    name: string;
    institution_id: string;
    lecturer_id: string | null;
  } | null;

  if (!module?.institution_id) {
    throw new Error("Session module institution could not be determined.");
  }

  const claimSnapshot = claimSnapshotFromScheduledSession(row);

  return {
    id: row.id,
    institutionId: module.institution_id,
    moduleId: module.id,
    moduleCode: module.code,
    moduleName: module.name,
    lecturerId: module.lecturer_id,
    tutorId: row.tutor_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    venueId: row.venue_id,
    venueText: row.venue_text,
    status: row.status,
    claimSnapshot,
  };
}
