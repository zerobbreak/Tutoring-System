import { createSupabaseServerClient } from "#/lib/supabase-server";
import { ATTENDANCE_REGISTER_BUCKET } from "#/server-actions/tutor-sessions/constants";
import type {
  AttendanceRecordDTO,
  TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions/types";

export type LecturerRow = { id: string; full_name: string; email: string };

export type RawModule = {
  id: string;
  code: string;
  name: string;
  lecturer_id: string;
  lecturer: LecturerRow | LecturerRow[] | null;
};

export type RawClaim = Omit<TutorSessionClaimDTO, "evidenceCount" | "module"> & {
  module: RawModule | RawModule[] | null;
  source_scheduled_session_id?: string | null;
  source_schedule_import_id?: string | null;
  admin_creation_approved_at?: string | null;
};

export function mapLecturer(
  lecturer: LecturerRow | LecturerRow[] | null,
): LecturerRow | null {
  if (lecturer == null) return null;
  return Array.isArray(lecturer) ? (lecturer[0] ?? null) : lecturer;
}

export function mapClaimRow(r: RawClaim, evidenceCount: number): TutorSessionClaimDTO {
  const m = r.module;
  const mod = m == null ? null : Array.isArray(m) ? (m[0] ?? null) : m;
  const moduleOut: TutorSessionClaimDTO["module"] = mod
    ? {
        id: mod.id,
        code: mod.code,
        name: mod.name,
        lecturer_id: mod.lecturer_id,
        lecturer: mapLecturer(mod.lecturer),
      }
    : null;
  const rawH = r.hours as unknown;
  const hours =
    typeof rawH === "string" ? Number.parseFloat(rawH) : Number(rawH);
  return {
    id: r.id,
    module_id: r.module_id,
    session_date: r.session_date,
    start_time: r.start_time,
    end_time: r.end_time,
    hours: Number.isFinite(hours) ? hours : 0,
    venue: r.venue,
    status: r.status,
    notes: r.notes,
    topics_covered: r.topics_covered,
    coverage_validated_at: r.coverage_validated_at,
    submitted_at: r.submitted_at,
    session_kind: r.session_kind,
    request_status: r.request_status ?? null,
    request_reason: r.request_reason ?? null,
    review_feedback: r.review_feedback ?? null,
    attendance_present_count: r.attendance_present_count,
    attendance_expected_count: r.attendance_expected_count,
    attendance_locked_at: r.attendance_locked_at ?? null,
    qr_token: r.qr_token,
    qr_expires_at: r.qr_expires_at,
    module: moduleOut,
    evidenceCount,
  };
}

export async function signAttendanceEvidenceUrl(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  fileUrl: string,
): Promise<string | null> {
  if (
    fileUrl.startsWith(`${ATTENDANCE_REGISTER_BUCKET}/`) ||
    !fileUrl.includes("://")
  ) {
    const path = fileUrl.startsWith(`${ATTENDANCE_REGISTER_BUCKET}/`)
      ? fileUrl.slice(ATTENDANCE_REGISTER_BUCKET.length + 1)
      : fileUrl;
    const { data: signed, error: sErr } = await supabase.storage
      .from(ATTENDANCE_REGISTER_BUCKET)
      .createSignedUrl(path, 3600);
    if (!sErr && signed?.signedUrl) return signed.signedUrl;
    return null;
  }
  return fileUrl;
}

export async function loadSessionAttendanceRecords(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  claimId: string,
): Promise<AttendanceRecordDTO[]> {
  const { data: rows, error } = await supabase
    .from("session_attendance")
    .select(
      `
        id,
        student_id,
        status,
        check_in_time,
        is_verified,
        notes,
        student:students (
          full_name,
          email,
          student_reference
        )
      `,
    )
    .eq("session_id", claimId)
    .order("check_in_time", { ascending: false });

  if (error) throw new Error(error.message);

  return (rows ?? []).map((r) => {
    const studentRaw = r.student;
    const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
    return {
      id: r.id as string,
      student_id: r.student_id as string,
      status: r.status as AttendanceRecordDTO["status"],
      check_in_time: r.check_in_time as string | null,
      is_verified: Boolean(r.is_verified),
      notes: r.notes as string | null,
      student: student as AttendanceRecordDTO["student"],
    };
  });
}
