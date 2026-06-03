import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  findOrCreateStudent,
  getSessionInstitutionId,
  recordSessionCheckIn,
} from "#/server-actions/tutor-sessions/student-roster";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import { studentRosterInputSchema } from "#/server-actions/tutor-sessions/student-check-in";

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
