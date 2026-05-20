import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { previewTutorSessionRequestCapacity } from "#/lib/schedule-claims/approve-tutor-session-request";
import { SESSION_REQUEST_STATUS } from "#/lib/session-request-status";
import { isTutorManualSessionClaim } from "#/lib/tutor-manual-session-claim";
import type { TutorSessionRequestDTO } from "./types";

const PENDING_SELECT = `
  id,
  session_date,
  start_time,
  end_time,
  hours,
  venue,
  status,
  updated_at,
  session_kind,
  request_reason,
  request_status,
  review_feedback,
  tutor_id,
  module_id,
  source_scheduled_session_id,
  source_schedule_import_id,
  tutor:users!session_claims_tutor_id_fkey ( id, full_name, email ),
  module:modules ( id, code, name )
`;

export async function loadPendingTutorSessionRequestsForLecturer(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  moduleIds: string[],
): Promise<TutorSessionRequestDTO[]> {
  if (!moduleIds.length) return [];

  const { data, error } = await supabase
    .from("session_claims")
    .select(PENDING_SELECT)
    .in("module_id", moduleIds)
    .in("request_status", [
      SESSION_REQUEST_STATUS.PENDING,
      SESSION_REQUEST_STATUS.CHANGES_REQUESTED,
    ])
    .is("source_scheduled_session_id", null)
    .is("source_schedule_import_id", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((row) =>
    isTutorManualSessionClaim(
      row as {
        source_scheduled_session_id: string | null;
        source_schedule_import_id: string | null;
      },
    ),
  );

  const out: TutorSessionRequestDTO[] = [];

  for (const row of rows) {
    const tutorRaw = row.tutor;
    const tutor = Array.isArray(tutorRaw) ? tutorRaw[0] : tutorRaw;
    const moduleRaw = row.module;
    const module = Array.isArray(moduleRaw) ? moduleRaw[0] : moduleRaw;
    const capacity = await previewTutorSessionRequestCapacity(supabase, {
      tutor_id: row.tutor_id as string,
      module_id: row.module_id as string,
      session_date: row.session_date as string,
      start_time: row.start_time as string,
      end_time: row.end_time as string,
      hours: row.hours as number | string,
    });

    out.push({
      id: row.id as string,
      sessionDate: row.session_date as string,
      startTime: row.start_time as string,
      endTime: row.end_time as string,
      hours: Number(row.hours),
      venue: row.venue as string | null,
      sessionKind: row.session_kind as string | null,
      requestReason: row.request_reason as string | null,
      requestStatus: row.request_status as string,
      reviewFeedback: row.review_feedback as string | null,
      updatedAt: row.updated_at as string,
      tutorName:
        (tutor as { full_name: string; email: string } | null)?.full_name?.trim() ||
        (tutor as { full_name: string; email: string } | null)?.email ||
        "Tutor",
      moduleCode: (module as { code: string } | null)?.code ?? "—",
      moduleName: (module as { name: string } | null)?.name ?? "",
      capacity,
    });
  }

  return out;
}
