import { createServerFn } from "@tanstack/react-start";
import { safeExternalHref } from "#/lib/safe-external-href";
import { parse } from "date-fns";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { executeClaimTransition } from "#/lib/claim-workflow/execute-transition";
import { assertTutorCanEditClaim } from "#/lib/claim-workflow/guards";
import { createStepUpMfaLogger } from "#/lib/claim-workflow/log-step-up-mfa";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import {
  assertValidQrSession,
  ensureQrTokenForClaim,
  findOrCreateStudent,
  getSessionInstitutionId,
  recordSessionCheckIn,
} from "#/server-actions/tutor-sessions/student-roster";
import {
  schedulingDateForColumn,
  type ClaimStatus,
  type TimeKanbanColumnId,
} from "#/lib/session-kanban-column";

async function requireUserId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

const timeColumnSchema = z.enum(["today", "upcoming", "completed"]);

const updateSchedulingSchema = z.object({
  claimId: z.string().uuid(),
  targetColumn: timeColumnSchema,
});

const submitClaimSchema = z.object({
  claimId: z.string().uuid(),
  stepUpCode: z.string().min(6).max(12),
});

const reopenClaimSchema = z.object({
  claimId: z.string().uuid(),
  stepUpCode: z.string().min(6).max(12),
});

const createClaimSchema = z.object({
  moduleId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  venue: z.string().max(255).optional(),
});

const attendanceCountsSchema = z.object({
  claimId: z.string().uuid(),
  attendancePresentCount: z.number().int().min(0).nullable(),
  attendanceExpectedCount: z.number().int().min(0).nullable(),
});

const listEvidenceSchema = z.object({
  claimId: z.string().uuid(),
});

const uploadEvidenceSchema = z.object({
  claimId: z.string().uuid(),
  fileBase64: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
});

const BUCKET = "attendance_registers";

export type TutorSessionClaimDTO = {
  id: string;
  module_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  venue: string | null;
  status: ClaimStatus;
  notes: string | null;
  topics_covered: string | null;
  coverage_validated_at: string | null;
  submitted_at: string | null;
  session_kind: string | null;
  creation_source?: string | null;
  scheduled_session_id?: string | null;
  scheduled_starts_at?: string | null;
  scheduled_ends_at?: string | null;
  attendance_locked_at?: string | null;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  qr_token: string | null;
  qr_expires_at: string | null;
  module: {
    id: string;
    code: string;
    name: string;
    lecturer_id: string;
    lecturer: {
      id: string;
      full_name: string;
      email: string;
    } | null;
  } | null;
  evidenceCount: number;
};

export type VerificationActionDTO = {
  id: string;
  claim_id: string;
  actor_id: string;
  actor: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  action_type: string;
  from_status: ClaimStatus | null;
  to_status: ClaimStatus | null;
  comment: string | null;
  acted_at: string;
};

export type ClaimEvidenceDTO = {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
};

export type ClaimDetailsDTO = TutorSessionClaimDTO & {
  evidence: ClaimEvidenceDTO[];
  history: VerificationActionDTO[];
};

type LecturerRow = { id: string; full_name: string; email: string };

type RawModule = {
  id: string;
  code: string;
  name: string;
  lecturer_id: string;
  lecturer: LecturerRow | LecturerRow[] | null;
};

type RawClaim = Omit<TutorSessionClaimDTO, "evidenceCount" | "module"> & {
  module: RawModule | RawModule[] | null;
};

function mapLecturer(
  lecturer: LecturerRow | LecturerRow[] | null,
): LecturerRow | null {
  if (lecturer == null) return null;
  return Array.isArray(lecturer) ? (lecturer[0] ?? null) : lecturer;
}

function mapClaimRow(r: RawClaim, evidenceCount: number): TutorSessionClaimDTO {
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
    attendance_present_count: r.attendance_present_count,
    attendance_expected_count: r.attendance_expected_count,
    qr_token: r.qr_token,
    qr_expires_at: r.qr_expires_at,
    module: moduleOut,
    evidenceCount,
  };
}

/** Load session claims for the signed-in tutor (nested module + lecturer). */
export const listTutorSessionClaimsFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<TutorSessionClaimDTO[]> => {
  const supabase = createSupabaseServerClient();
  const tutorId = await requireUserId(supabase);

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
        attendance_present_count,
        attendance_expected_count,
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

  return rows.map((r) => mapClaimRow(r, countMap.get(r.id) ?? 0));
});

/** Reschedule claim into a time-based Kanban column (today / upcoming / completed). */
export const updateSessionClaimSchedulingFn = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => updateSchedulingSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);
    const now = new Date();
    const session_date = schedulingDateForColumn(
      data.targetColumn as TimeKanbanColumnId,
      now,
    );

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select("id, status, frozen_at")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");
    assertTutorCanEditClaim(
      row.status as ClaimStatus,
      row.frozen_at as string | null,
      "reschedule this session",
    );

    const { error: upErr } = await supabase
      .from("session_claims")
      .update({ session_date })
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId);

    if (upErr) throw new Error(upErr.message);
    return { ok: true as const, session_date };
  });

/** Submit a draft claim for verification. */
export const submitSessionClaimFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitClaimSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select("id")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");

    await executeClaimTransition(supabase, {
      claimId: data.claimId,
      action: "SUBMIT",
      actor: { userId: tutorId, role: "TUTOR" },
      stepUpCode: data.stepUpCode,
      logStepUpMfa: createStepUpMfaLogger(supabase, tutorId),
    });

    return { ok: true as const };
  });

/** Reopen a rejected or disputed claim for correction (returns to draft). */
export const reopenSessionClaimFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => reopenClaimSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select("id")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");

    await executeClaimTransition(supabase, {
      claimId: data.claimId,
      action: "REOPEN",
      actor: { userId: tutorId, role: "TUTOR" },
      stepUpCode: data.stepUpCode,
      logStepUpMfa: createStepUpMfaLogger(supabase, tutorId),
    });

    return { ok: true as const };
  });

/** Create a manual session claim (draft). */
export const createSessionClaimFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createClaimSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: assign, error: aErr } = await supabase
      .from("tutor_assignments")
      .select("id")
      .eq("tutor_id", tutorId)
      .eq("module_id", data.moduleId)
      .eq("is_active", true)
      .maybeSingle();

    if (aErr) throw new Error(aErr.message);
    if (!assign) {
      throw new Error(
        "You can only create sessions for modules you are assigned to.",
      );
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const parseClock = (t: string) => {
      const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t.trim());
      if (!m) throw new Error("Invalid time format. Use HH:mm.");
      return {
        h: Number(m[1]),
        mi: Number(m[2]),
        s: m[3] ? Number(m[3]) : 0,
      };
    };
    const a = parseClock(data.startTime);
    const b = parseClock(data.endTime);
    const start_time = `${pad(a.h)}:${pad(a.mi)}:${pad(a.s)}`;
    const end_time = `${pad(b.h)}:${pad(b.mi)}:${pad(b.s)}`;

    const base = parse(data.sessionDate, "yyyy-MM-dd", new Date());
    const s = new Date(base);
    s.setHours(a.h, a.mi, a.s, 0);
    const e = new Date(base);
    e.setHours(b.h, b.mi, b.s, 0);
    if (e.getTime() <= s.getTime()) {
      e.setDate(e.getDate() + 1);
    }
    const ms = e.getTime() - s.getTime();
    const hours = Math.round((ms / (1000 * 60 * 60)) * 100) / 100;

    const venue =
      data.venue?.trim() === "" ? null : (data.venue?.trim() ?? null);

    const row = {
      tutor_id: tutorId,
      module_id: data.moduleId,
      session_date: data.sessionDate,
      start_time,
      end_time,
      hours,
      venue,
      status: "DRAFT" as const,
      source_schedule_import_id: null as string | null,
      source_event_fingerprint: "",
      session_kind: "ad_hoc",
      creation_source: "TUTOR_MANUAL" as const,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("session_claims")
      .insert(row)
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);
    return { claimId: inserted!.id as string };
  });

export const upsertAttendanceCountsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => attendanceCountsSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: claimRow, error: cErr } = await supabase
      .from("session_claims")
      .select("status, frozen_at")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claimRow) throw new Error("Session not found.");
    assertTutorCanEditClaim(
      claimRow.status as ClaimStatus,
      claimRow.frozen_at as string | null,
      "update attendance for this session",
    );

    const { error } = await supabase
      .from("session_claims")
      .update({
        attendance_present_count: data.attendancePresentCount,
        attendance_expected_count: data.attendanceExpectedCount,
      })
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type AttendanceEvidenceRow = {
  id: string;
  file_url: string;
  file_type: string;
  original_filename: string;
  file_size_bytes: number | null;
  uploaded_at: string | null;
  signedUrl: string | null;
};

/** Evidence rows for a claim, with short-lived signed URLs when possible. */
export const listAttendanceEvidenceFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => listEvidenceSchema.parse(input))
  .handler(async ({ data }): Promise<AttendanceEvidenceRow[]> => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: claim, error: cErr } = await supabase
      .from("session_claims")
      .select("id")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claim) throw new Error("Session not found.");

    const { data: rows, error } = await supabase
      .from("attendance_evidence")
      .select(
        "id, file_url, file_type, original_filename, file_size_bytes, uploaded_at",
      )
      .eq("claim_id", data.claimId)
      .order("uploaded_at", { ascending: false });

    if (error) throw new Error(error.message);

    const out: AttendanceEvidenceRow[] = [];
    for (const r of rows ?? []) {
      let signedUrl: string | null = null;
      const url = r.file_url as string;
      if (url.startsWith(`${BUCKET}/`) || !url.includes("://")) {
        const path = url.startsWith(`${BUCKET}/`) ? url.slice(BUCKET.length + 1) : url;
        const { data: signed, error: sErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);
        if (!sErr && signed?.signedUrl) {
          signedUrl = safeExternalHref(signed.signedUrl);
        }
      } else {
        signedUrl = safeExternalHref(url);
      }
      out.push({
        id: r.id as string,
        file_url: url,
        file_type: r.file_type as string,
        original_filename: r.original_filename as string,
        file_size_bytes: r.file_size_bytes as number | null,
        uploaded_at: r.uploaded_at as string | null,
        signedUrl,
      });
    }
    return out;
  });

/** Upload register file to storage and insert attendance_evidence. */
export const registerAttendanceEvidenceFn = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => uploadEvidenceSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const buf = Buffer.from(data.fileBase64, "base64");
    if (buf.byteLength > 12 * 1024 * 1024) {
      throw new Error("File too large (max 12MB).");
    }

    const { data: claim, error: cErr } = await supabase
      .from("session_claims")
      .select("id, status, frozen_at")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claim) throw new Error("Session not found.");
    assertTutorCanEditClaim(
      claim.status as ClaimStatus,
      claim.frozen_at as string | null,
      "upload evidence for this session",
    );

    const safeName = data.fileName.replace(/[^\w.\-()+ ]/g, "_").slice(0, 200);
    const objectPath = `${tutorId}/${data.claimId}/${crypto.randomUUID()}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buf, {
        contentType: data.mimeType,
        upsert: false,
      });

    if (upErr) throw new Error(upErr.message);

    const storageRef = `${BUCKET}/${objectPath}`;

    const { error: insErr } = await supabase.from("attendance_evidence").insert({
      claim_id: data.claimId,
      file_url: storageRef,
      file_type: data.mimeType,
      original_filename: data.fileName,
      file_size_bytes: buf.byteLength,
    });

    if (insErr) throw new Error(insErr.message);
    return { ok: true as const, file_url: storageRef };
  });

export type TutorModuleOption = {
  moduleId: string;
  code: string;
  name: string;
};

/** Modules the tutor is actively assigned to (for create-session picker). */
export const listTutorModuleAssignmentsFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<TutorModuleOption[]> => {
  const supabase = createSupabaseServerClient();
  const tutorId = await requireUserId(supabase);

  const { data, error } = await supabase
    .from("tutor_assignments")
    .select("module:modules ( id, code, name )")
    .eq("tutor_id", tutorId)
    .eq("is_active", true)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);

  const out: TutorModuleOption[] = [];
  for (const row of data ?? []) {
    const m = row.module as
      | { id: string; code: string; name: string }
      | { id: string; code: string; name: string }[]
      | null;
    const mod = m == null ? null : Array.isArray(m) ? m[0] : m;
    if (mod)
      out.push({ moduleId: mod.id, code: mod.code, name: mod.name });
  }
  return out;
});

const generateQRSchema = z.object({
  claimId: z.string().uuid(),
  expiresInMinutes: z.number().int().min(1).max(1440).default(30),
});

/** Generate/refresh a secure QR token for a session. */
export const generateSessionTokenFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => generateQRSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: claimRow, error: cErr } = await supabase
      .from("session_claims")
      .select("status, frozen_at, source_scheduled_session_id")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claimRow) throw new Error("Session not found.");
    assertTutorCanEditClaim(
      claimRow.status as ClaimStatus,
      claimRow.frozen_at as string | null,
      "generate a QR code for this session",
    );

    if (claimRow.source_scheduled_session_id) {
      return ensureQrTokenForClaim(supabase, data.claimId);
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + data.expiresInMinutes);
    const qr_token = crypto.randomUUID();

    const { error } = await supabase
      .from("session_claims")
      .update({
        qr_token,
        qr_expires_at: expiresAt.toISOString(),
      })
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId);

    if (error) throw new Error(error.message);
    return { qr_token, qr_expires_at: expiresAt.toISOString() };
  });

export type AttendanceRecordDTO = {
  id: string;
  student_id: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
  check_in_time: string | null;
  is_verified: boolean;
  notes: string | null;
  student: {
    full_name: string;
    email: string | null;
    student_reference: string | null;
  };
};

/** Get the detailed attendance roster for a session. */
export const getAttendanceDataFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ claimId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<AttendanceRecordDTO[]> => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    // Verify ownership
    const { data: claim, error: cErr } = await supabase
      .from("session_claims")
      .select("id")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claim) throw new Error("Session not found.");

    const { data: rows, error } = await supabase
      .from("session_attendance")
      .select(`
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
      `)
      .eq("session_id", data.claimId)
      .order("check_in_time", { ascending: false });

    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => ({
      ...r,
      student: Array.isArray(r.student) ? r.student[0] : r.student,
    }));
  });

/** Get aggregate attendance trends. */
export const getHistoricalAttendanceFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    // Simple aggregate query for the last 10 sessions
    const { data, error } = await supabase
      .from("session_claims")
      .select(`
        id,
        session_date,
        attendance_present_count,
        attendance_expected_count
      `)
      .eq("tutor_id", tutorId)
      .not("attendance_present_count", "is", null)
      .order("session_date", { ascending: true })
      .limit(10);

    if (error) throw new Error(error.message);

    return data.map(d => ({
      date: d.session_date,
      present: d.attendance_present_count || 0,
      expected: d.attendance_expected_count || 0,
    }));
  });

const studentRosterInputSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  studentReference: z.string().trim().min(1).max(100),
  email: z
    .string()
    .trim()
    .max(255)
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Enter a valid email address.",
    })
    .optional(),
});

/** Student self check-in via QR token (registers roster entry when new). */
export const checkInStudentFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().uuid(),
        sessionId: z.string().uuid(),
      })
      .merge(studentRosterInputSchema)
      .parse(input),
  )
  .handler(async ({ data }) => {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error(
        "Check-in is not available right now. Please ask your tutor to register you manually.",
      );
    }

    await assertValidQrSession(admin, data.sessionId, data.token);
    const institutionId = await getSessionInstitutionId(admin, data.sessionId);
    const student = await findOrCreateStudent(admin, institutionId, {
      fullName: data.fullName,
      studentReference: data.studentReference,
      email: data.email || null,
    });
    await recordSessionCheckIn(admin, data.sessionId, student.id);

    return {
      success: true,
      studentName: student.full_name,
      registered: student.created,
    };
  });

/** Tutor manually registers a student on the session roster. */
export const registerStudentForSessionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        claimId: z.string().uuid(),
      })
      .merge(studentRosterInputSchema)
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: claim, error: cErr } = await supabase
      .from("session_claims")
      .select("id")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claim) throw new Error("Session not found.");

    const institutionId = await getSessionInstitutionId(supabase, data.claimId);
    const student = await findOrCreateStudent(supabase, institutionId, {
      fullName: data.fullName,
      studentReference: data.studentReference,
      email: data.email || null,
    });
    await recordSessionCheckIn(supabase, data.claimId, student.id);

    return {
      success: true,
      studentName: student.full_name,
      registered: student.created,
    };
  });

/** Get detailed information for a single claim, including history and evidence. */
export const getClaimDetailsFn = createServerFn({
  method: "GET",
})
  .inputValidator((input: unknown) =>
    z.object({ claimId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<ClaimDetailsDTO> => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: claimRow, error: cErr } = await supabase
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
        attendance_present_count,
        attendance_expected_count,
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
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claimRow) throw new Error("Claim not found.");

    const { data: evRows, error: evErr } = await supabase
      .from("attendance_evidence")
      .select("id, file_url, original_filename, uploaded_at")
      .eq("claim_id", data.claimId)
      .order("uploaded_at", { ascending: false });

    if (evErr) throw new Error(evErr.message);

    const evidence: ClaimEvidenceDTO[] = [];
    for (const r of evRows ?? []) {
      let file_url = r.file_url as string;
      if (file_url.startsWith(`${BUCKET}/`)) {
        const path = file_url.slice(BUCKET.length + 1);
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);
        if (signed?.signedUrl) file_url = signed.signedUrl;
      }
      evidence.push({
        id: r.id as string,
        file_name: r.original_filename as string,
        file_url,
        uploaded_at: (r.uploaded_at as string) || new Date().toISOString(),
      });
    }

    const { data: historyRows, error: hErr } = await supabase
      .from("verification_actions")
      .select(
        `
        id,
        claim_id,
        actor_id,
        action_type,
        from_status,
        to_status,
        comment,
        acted_at,
        actor:users ( id, full_name, email )
      `,
      )
      .eq("claim_id", data.claimId)
      .order("acted_at", { ascending: false });

    if (hErr) throw new Error(hErr.message);

    const history: VerificationActionDTO[] = (historyRows ?? []).map(
      (r: any) => ({
        id: r.id,
        claim_id: r.claim_id,
        actor_id: r.actor_id,
        action_type: r.action_type,
        from_status: r.from_status,
        to_status: r.to_status,
        comment: r.comment,
        acted_at: r.acted_at,
        actor: Array.isArray(r.actor) ? r.actor[0] : r.actor,
      }),
    );

    const mapped = mapClaimRow(claimRow as any, evidence.length);

    return {
      ...mapped,
      evidence,
      history,
    };
  });

export { listTutorOperationalSessionsFn } from "./list-operational-sessions";
