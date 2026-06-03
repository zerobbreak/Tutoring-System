import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { isTutorSessionClaimListed } from "#/lib/tutor-manual-session-claim";
import { syncTutorDraftClaimsFromSchedule } from "#/lib/schedule-claims/ensure-scheduled-session-claim";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import { mapClaimRow, type RawClaim } from "#/server-actions/tutor-sessions/mappers";
import { purgeExpiredDraftClaimsForTutor } from "#/server-actions/tutor-sessions/purge-expired-drafts";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions/types";

/** Load session claims for the signed-in tutor (nested module + lecturer). */
export const listTutorSessionClaimsFn = createServerFn({
  method: "POST",
}).handler(async (): Promise<TutorSessionClaimDTO[]> => {
  const supabase = createSupabaseServerClient();
  const tutorId = await requireUserId(supabase);

  try {
    await purgeExpiredDraftClaimsForTutor(supabase, tutorId);
  } catch {
    /* Best-effort purge — do not block sessions/claims workspace load */
  }

  try {
    await syncTutorDraftClaimsFromSchedule(supabase, tutorId);
  } catch {
    /* Best-effort — keep listing when schedule sync fails */
  }

  const { data, error } = await supabase
    .from("session_claims")
    .select(
      `
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
        request_status,
        request_reason,
        review_feedback,
        source_scheduled_session_id,
        source_schedule_import_id,
        admin_creation_approved_at,
        attendance_present_count,
        attendance_expected_count,
        attendance_locked_at,
        qr_token,
        qr_expires_at,
        module:modules (
          id,
          code,
          name,
          lecturer_id,
          lecturer:users!modules_lecturer_id_fkey ( id, full_name, email )
        )
      `,
    )
    .eq("tutor_id", tutorId)
    .is("deleted_at", null)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawClaim[];
  const ids = rows.map((r) => r.id);
  const countMap = new Map<string, number>();
  if (ids.length) {
    const { data: evRows, error: evErr } = await supabase
      .from("attendance_evidence")
      .select("claim_id")
      .in("claim_id", ids);
    if (evErr) throw new Error(evErr.message);
    for (const row of evRows ?? []) {
      const id = row.claim_id as string;
      countMap.set(id, (countMap.get(id) ?? 0) + 1);
    }
  }

  return rows
    .filter((r) =>
      isTutorSessionClaimListed({
        source_scheduled_session_id: r.source_scheduled_session_id as string | null,
        source_schedule_import_id: r.source_schedule_import_id as string | null,
        admin_creation_approved_at: r.admin_creation_approved_at as string | null,
        request_status: r.request_status as string | null,
      }),
    )
    .map((r) => mapClaimRow(r, countMap.get(r.id) ?? 0));
});
