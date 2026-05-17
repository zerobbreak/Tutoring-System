import type { SupabaseClient } from "@supabase/supabase-js";
import { isAfter, parseISO } from "date-fns";

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
    .select("id, qr_token, qr_expires_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!claim) throw new Error("Session not found.");
  if (claim.qr_token !== token) throw new Error("Invalid QR token.");
  if (
    claim.qr_expires_at &&
    isAfter(new Date(), parseISO(claim.qr_expires_at as string))
  ) {
    throw new Error("QR token has expired.");
  }
}
