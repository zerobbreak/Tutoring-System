import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import {
  assertValidQrSession,
  findOrCreateStudent,
  getCheckInSessionPreview,
  getSessionInstitutionId,
  recordSessionCheckIn,
} from "#/server-actions/tutor-sessions/student-roster";
import type { CheckInSessionPreview } from "#/server-actions/tutor-sessions/types";

export const studentRosterInputSchema = z.object({
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

/** Session summary for the public check-in page (validates QR token). */
export const getCheckInSessionPreviewFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().uuid(),
        sessionId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CheckInSessionPreview> => {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new Error("Check-in is not available right now.");
    }
    return getCheckInSessionPreview(admin, data.sessionId, data.token);
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
