import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { parseStudentCardPayload } from "#/lib/student-card-payload";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  assertSessionOpenForTutorScan,
  findOrCreateStudentFromScan,
  getSessionInstitutionId,
  recordSessionCheckIn,
} from "#/server-actions/tutor-sessions/student-roster";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import type { ScanStudentForSessionResult } from "#/server-actions/tutor-sessions/types";

/** Tutor scans a student card to mark them present for the active session. */
export const scanStudentForSessionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        claimId: z.string().uuid(),
        payload: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ScanStudentForSessionResult> => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    await assertSessionOpenForTutorScan(supabase, data.claimId, tutorId);

    const card = parseStudentCardPayload(data.payload);
    const institutionId = await getSessionInstitutionId(supabase, data.claimId);
    const student = await findOrCreateStudentFromScan(
      supabase,
      institutionId,
      card,
    );

    try {
      await recordSessionCheckIn(supabase, data.claimId, student.id);
      return {
        success: true,
        studentId: student.id,
        studentName: student.full_name,
        registered: student.created,
        alreadyPresent: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("already marked present")) {
        return {
          success: true,
          studentId: student.id,
          studentName: student.full_name,
          registered: false,
          alreadyPresent: true,
        };
      }
      throw err;
    }
  });
