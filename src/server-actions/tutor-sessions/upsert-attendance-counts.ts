import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertClaimNotFrozen } from "#/server-actions/admin-approvals/assert-claim-not-frozen";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";

const attendanceCountsSchema = z.object({
  claimId: z.string().uuid(),
  attendancePresentCount: z.number().int().min(0).nullable(),
  attendanceExpectedCount: z.number().int().min(0).nullable(),
});

export const upsertAttendanceCountsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => attendanceCountsSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: claimRow, error: cErr } = await supabase
      .from("session_claims")
      .select("frozen_at")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claimRow) throw new Error("Session not found.");
    assertClaimNotFrozen(claimRow.frozen_at as string | null);

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
