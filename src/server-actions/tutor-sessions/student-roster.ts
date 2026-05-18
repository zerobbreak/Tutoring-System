import type { SupabaseClient } from "@supabase/supabase-js";
import { format, isAfter, parseISO } from "date-fns";
import {
  isAttendanceLocked,
  isWithinQrWindow,
  qrWindowForScheduledSession,
} from "#/lib/session-qr-window";

export type StudentRosterInput = {
  fullName: string;
  studentReference: string;
  email?: string | null;
};

export type ResolvedStudent = {
  id: string;
  full_name: string;
  student_reference: string | null;
  email: string | null;
  created: boolean;
};

function normalizeReference(value: string): string {
  return value.trim();
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

/** Load institution for a session via its module. */
export async function getSessionInstitutionId(
  db: SupabaseClient,
  sessionId: string,
): Promise<string> {
  const { data, error } = await db
    .from("session_claims")
    .select(
      `
      id,
      module:modules (
        institution_id
      )
    `,
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Session not found.");

  const mod = Array.isArray(data.module) ? data.module[0] : data.module;
  const institutionId = mod?.institution_id as string | undefined;
  if (!institutionId) {
    throw new Error("Session institution could not be determined.");
  }
  return institutionId;
}

/** Find by student number within institution, or create a roster entry. */
export async function findOrCreateStudent(
  db: SupabaseClient,
  institutionId: string,
  input: StudentRosterInput,
): Promise<ResolvedStudent> {
  const studentReference = normalizeReference(input.studentReference);
  if (!studentReference) {
    throw new Error("Student number is required.");
  }

  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Full name is required.");

  const email = normalizeEmail(input.email);

  const { data: existing, error: findErr } = await db
    .from("students")
    .select("id, full_name, student_reference, email")
    .eq("institution_id", institutionId)
    .eq("student_reference", studentReference)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);

  if (existing) {
    const updates: Record<string, string> = {};
    if (existing.full_name !== fullName) updates.full_name = fullName;
    if (email && existing.email !== email) updates.email = email;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await db
        .from("students")
        .update(updates)
        .eq("id", existing.id);
      if (updateErr) throw new Error(updateErr.message);
    }

    return {
      id: existing.id,
      full_name: updates.full_name ?? existing.full_name,
      student_reference: existing.student_reference,
      email: updates.email ?? existing.email,
      created: false,
    };
  }

  const { data: created, error: insertErr } = await db
    .from("students")
    .insert({
      institution_id: institutionId,
      full_name: fullName,
      student_reference: studentReference,
      email,
      is_active: true,
    })
    .select("id, full_name, student_reference, email")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      throw new Error(
        "A student with this number already exists at your institution.",
      );
    }
    throw new Error(insertErr.message);
  }

  return { ...created, created: true };
}

/** Record present attendance and refresh the session present count. */
export async function recordSessionCheckIn(
  db: SupabaseClient,
  sessionId: string,
  studentId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing, error: findErr } = await db
    .from("session_attendance")
    .select("id")
    .eq("session_id", sessionId)
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (existing?.id) {
    throw new Error("You have already checked in for this session.");
  }

  const { error: insertErr } = await db.from("session_attendance").insert({
    session_id: sessionId,
    student_id: studentId,
    status: "PRESENT",
    check_in_time: now,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      throw new Error("You have already checked in for this session.");
    }
    throw new Error(insertErr.message);
  }

  const { count, error: countErr } = await db
    .from("session_attendance")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .is("deleted_at", null);

  if (countErr) throw new Error(countErr.message);

  const { error: claimErr } = await db
    .from("session_claims")
    .update({ attendance_present_count: count ?? 0 })
    .eq("id", sessionId);

  if (claimErr) throw new Error(claimErr.message);
}

export async function assertValidQrSession(
  db: SupabaseClient,
  sessionId: string,
  token: string,
): Promise<void> {
  const { data: claim, error } = await db
    .from("session_claims")
    .select(
      `
      id,
      qr_token,
      qr_expires_at,
      attendance_locked_at,
      session_date,
      start_time,
      end_time,
      source_scheduled_session_id,
      scheduled:scheduled_sessions ( starts_at, ends_at, status )
    `,
    )
    .eq("id", sessionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!claim) throw new Error("Session not found.");

  if (claim.attendance_locked_at) {
    throw new Error("Attendance is locked for this session.");
  }

  const scheduled = claim.scheduled as {
    starts_at: string;
    ends_at: string;
    status: string;
  } | null;

  if (scheduled?.status === "CANCELLED") {
    throw new Error("This session was cancelled.");
  }

  let bounds: { startsAt: string; endsAt: string } | null = null;
  if (scheduled?.starts_at && scheduled?.ends_at) {
    bounds = { startsAt: scheduled.starts_at, endsAt: scheduled.ends_at };
  } else if (claim.session_date && claim.start_time && claim.end_time) {
    bounds = {
      startsAt: `${claim.session_date}T${claim.start_time}`,
      endsAt: `${claim.session_date}T${claim.end_time}`,
    };
  }

  if (bounds && isAttendanceLocked(bounds)) {
    throw new Error("Attendance is locked for this session.");
  }

  if (claim.qr_token !== token) throw new Error("Invalid QR token.");

  if (bounds) {
    if (!isWithinQrWindow(bounds)) {
      throw new Error("QR check-in is not open for this session.");
    }
    return;
  }

  if (
    claim.qr_expires_at &&
    isAfter(new Date(), parseISO(claim.qr_expires_at as string))
  ) {
    throw new Error("QR token has expired.");
  }
}

export type CheckInSessionPreview = {
  moduleCode: string;
  moduleName: string;
  sessionWhen: string;
  tutorName: string | null;
};

/** Public session summary for the student QR check-in page (token must be valid). */
export async function getCheckInSessionPreview(
  db: SupabaseClient,
  sessionId: string,
  token: string,
): Promise<CheckInSessionPreview> {
  await assertValidQrSession(db, sessionId, token);

  const { data: claim, error } = await db
    .from("session_claims")
    .select(
      `
      session_date,
      start_time,
      end_time,
      module:modules ( code, name ),
      tutor:users!session_claims_tutor_id_fkey ( full_name ),
      scheduled:scheduled_sessions ( starts_at, ends_at )
    `,
    )
    .eq("id", sessionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!claim) throw new Error("Session not found.");

  const mod = claim.module as
    | { code: string; name: string }
    | { code: string; name: string }[]
    | null;
  const moduleRow = Array.isArray(mod) ? mod[0] : mod;
  const tutor = claim.tutor as
    | { full_name: string }
    | { full_name: string }[]
    | null;
  const tutorRow = Array.isArray(tutor) ? tutor[0] : tutor;
  const scheduled = claim.scheduled as {
    starts_at: string;
    ends_at: string;
  } | null;

  let sessionWhen = "—";
  if (scheduled?.starts_at) {
    const start = parseISO(scheduled.starts_at);
    const end = scheduled.ends_at ? parseISO(scheduled.ends_at) : null;
    sessionWhen = end
      ? `${format(start, "EEE d MMM yyyy")} · ${format(start, "HH:mm")}–${format(end, "HH:mm")}`
      : format(start, "EEE d MMM yyyy · HH:mm");
  } else if (claim.session_date) {
    const date = claim.session_date as string;
    const start = (claim.start_time as string | null)?.slice(0, 5);
    const end = (claim.end_time as string | null)?.slice(0, 5);
    sessionWhen =
      start && end
        ? `${format(parseISO(date), "EEE d MMM yyyy")} · ${start}–${end}`
        : format(parseISO(date), "EEE d MMM yyyy");
  }

  return {
    moduleCode: moduleRow?.code ?? "—",
    moduleName: moduleRow?.name ?? "",
    sessionWhen,
    tutorName: tutorRow?.full_name ?? null,
  };
}

/** Ensure QR token exists with expiry aligned to scheduled session window. */
export async function ensureQrTokenForClaim(
  db: SupabaseClient,
  claimId: string,
): Promise<{ qr_token: string; qr_expires_at: string }> {
  const { data: claim, error } = await db
    .from("session_claims")
    .select(
      `
      id,
      qr_token,
      qr_expires_at,
      source_scheduled_session_id,
      session_date,
      start_time,
      end_time,
      scheduled:scheduled_sessions ( starts_at, ends_at )
    `,
    )
    .eq("id", claimId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!claim) throw new Error("Session not found.");

  const scheduled = claim.scheduled as { starts_at: string; ends_at: string } | null;
  let expiresAt: Date;
  if (scheduled?.starts_at && scheduled?.ends_at) {
    expiresAt = qrWindowForScheduledSession({
      startsAt: scheduled.starts_at,
      endsAt: scheduled.ends_at,
    }).validUntil;
  } else {
    expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
  }

  const qr_token = (claim.qr_token as string | null) ?? crypto.randomUUID();
  const qr_expires_at = expiresAt.toISOString();

  const { error: upErr } = await db
    .from("session_claims")
    .update({ qr_token, qr_expires_at })
    .eq("id", claimId);

  if (upErr) throw new Error(upErr.message);
  return { qr_token, qr_expires_at };
}
