import { createServerFn } from "@tanstack/react-start";
import { addDays } from "date-fns";
import {
  extendSeriesHorizon,
  needsHorizonExtension,
} from "#/lib/schedule-materialize";
import { scheduleClaimTimesFromTimestamps } from "#/lib/schedule-claim-times";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { ensureClaimForScheduledSession } from "#/server-actions/lecturer-schedule/ensure-claim-for-session";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import {
  mapLecturer,
  type LecturerRow,
} from "#/server-actions/tutor-sessions/mappers";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions/types";

const CLAIM_SELECT = `
  id,
  module_id,
  session_date,
  start_time,
  end_time,
  hours,
  venue,
  status,
  notes,
  topics_covered,
  coverage_validated_at,
  submitted_at,
  session_kind,
  creation_source,
  attendance_present_count,
  attendance_expected_count,
  attendance_locked_at,
  qr_token,
  qr_expires_at,
  source_scheduled_session_id,
  module:modules (
    id,
    code,
    name,
    lecturer_id,
    lecturer:users!modules_lecturer_id_fkey ( id, full_name, email )
  )
`;

/** Session-first list: official schedule occurrences + ad-hoc/import claims. */
export const listTutorOperationalSessionsFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<TutorSessionClaimDTO[]> => {
  const supabase = createSupabaseServerClient();
  const tutorId = await requireUserId(supabase);

  const { data: tutorSeries, error: seriesErr } = await supabase
    .from("schedule_series")
    .select("id, materialized_until")
    .eq("tutor_id", tutorId)
    .eq("status", "PUBLISHED")
    .is("deleted_at", null);

  if (seriesErr) throw new Error(seriesErr.message);
  for (const s of tutorSeries ?? []) {
    if (needsHorizonExtension(s.materialized_until as string | null)) {
      try {
        await extendSeriesHorizon(supabase, s.id as string);
      } catch {
        /* best-effort */
      }
    }
  }

  const now = new Date();
  const from = addDays(now, -90).toISOString();
  const to = addDays(now, 120).toISOString();

  const { data: scheduled, error: schedErr } = await supabase
    .from("scheduled_sessions")
    .select("id, starts_at, ends_at, status")
    .eq("tutor_id", tutorId)
    .gte("starts_at", from)
    .lte("starts_at", to)
    .is("deleted_at", null)
    .neq("status", "CANCELLED");

  if (schedErr) throw new Error(schedErr.message);

  for (const row of scheduled ?? []) {
    try {
      await ensureClaimForScheduledSession(supabase, row.id as string);
    } catch {
      /* skip cancelled or inaccessible */
    }
  }

  const { data: claims, error: claimErr } = await supabase
    .from("session_claims")
    .select(CLAIM_SELECT)
    .eq("tutor_id", tutorId)
    .is("deleted_at", null)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (claimErr) throw new Error(claimErr.message);

  const claimIds = (claims ?? []).map((c) => c.id as string);
  const evidenceCountByClaim = new Map<string, number>();

  if (claimIds.length) {
    const { data: evidence, error: evErr } = await supabase
      .from("attendance_evidence")
      .select("claim_id")
      .in("claim_id", claimIds);

    if (evErr) throw new Error(evErr.message);
    for (const e of evidence ?? []) {
      const id = e.claim_id as string;
      evidenceCountByClaim.set(id, (evidenceCountByClaim.get(id) ?? 0) + 1);
    }
  }

  const scheduledById = new Map(
    (scheduled ?? []).map((s) => [s.id as string, s]),
  );

  const out: TutorSessionClaimDTO[] = [];

  for (const r of claims ?? []) {
    const m = r.module as
      | {
          id: string;
          code: string;
          name: string;
          lecturer_id: string;
          lecturer: LecturerRow | LecturerRow[] | null;
        }
      | {
          id: string;
          code: string;
          name: string;
          lecturer_id: string;
          lecturer: LecturerRow | LecturerRow[] | null;
        }[]
      | null;
    const mod = m == null ? null : Array.isArray(m) ? (m[0] ?? null) : m;

    const schedId = r.source_scheduled_session_id as string | null;
    const sched = schedId ? scheduledById.get(schedId) : undefined;
    let session_date = r.session_date as string;
    let start_time = r.start_time as string | null;
    let end_time = r.end_time as string | null;
    let hours = Number(r.hours);

    if (sched?.starts_at && sched?.ends_at) {
      const times = scheduleClaimTimesFromTimestamps(
        new Date(sched.starts_at as string),
        new Date(sched.ends_at as string),
      );
      session_date = times.session_date;
      start_time = times.start_time;
      end_time = times.end_time;
      hours = times.hours;
    }

    const rawH = r.hours as unknown;
    if (!sched) {
      hours =
        typeof rawH === "string" ? Number.parseFloat(rawH) : Number(rawH);
    }

    out.push({
      id: r.id as string,
      module_id: r.module_id as string,
      session_date,
      start_time,
      end_time,
      hours: Number.isFinite(hours) ? hours : 0,
      venue: r.venue as string | null,
      status: r.status as TutorSessionClaimDTO["status"],
      notes: r.notes as string | null,
      topics_covered: r.topics_covered as string | null,
      coverage_validated_at: r.coverage_validated_at as string | null,
      submitted_at: r.submitted_at as string | null,
      session_kind: r.session_kind as string | null,
      attendance_present_count: r.attendance_present_count as number | null,
      attendance_expected_count: r.attendance_expected_count as number | null,
      qr_token: r.qr_token as string | null,
      qr_expires_at: r.qr_expires_at as string | null,
      scheduled_session_id: schedId,
      scheduled_starts_at: sched?.starts_at as string | undefined,
      scheduled_ends_at: sched?.ends_at as string | undefined,
      creation_source: r.creation_source as string | null,
      attendance_locked_at: r.attendance_locked_at as string | null,
      module: mod
        ? {
            id: mod.id,
            code: mod.code,
            name: mod.name,
            lecturer_id: mod.lecturer_id,
            lecturer: mapLecturer(mod.lecturer),
          }
        : null,
      evidenceCount: evidenceCountByClaim.get(r.id as string) ?? 0,
    });
  }

  return out;
});
