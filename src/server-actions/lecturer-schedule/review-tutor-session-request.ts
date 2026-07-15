import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { SESSION_REQUEST_STATUS } from "#/lib/session-request-status";
import { isTutorManualSessionClaim } from "#/lib/tutor-manual-session-claim";
import { createSupabaseServerClient } from "#/lib/supabase-server";

const reviewSchema = z.object({
  claimId: z.string().uuid(),
  decision: z.enum(["REJECTED", "CHANGES_REQUESTED"]),
  feedback: z.string().max(2000).optional(),
});

/** Lecturer may reject or suggest changes; admin approves and materializes schedule. */
export const reviewTutorSessionRequestFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select(
        `
        id,
        tutor_id,
        module_id,
        request_status,
        source_scheduled_session_id,
        source_schedule_import_id,
        module:modules ( lecturer_id )
      `,
      )
      .eq("id", data.claimId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");
    if (!isTutorManualSessionClaim(row)) {
      throw new Error("Only tutor session requests can be reviewed here.");
    }

    const modRaw = row.module;
    const mod = Array.isArray(modRaw) ? modRaw[0] : modRaw;
    if ((mod as { lecturer_id: string } | null)?.lecturer_id !== lecturerId) {
      throw new Error("Module not found or access denied.");
    }

    if (data.decision === "CHANGES_REQUESTED") {
      const feedback = data.feedback?.trim();
      if (!feedback || feedback.length < 3) {
        throw new Error("Please describe what the tutor should change.");
      }
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("session_claims")
      .update({
        request_status:
          data.decision === "REJECTED"
            ? SESSION_REQUEST_STATUS.REJECTED
            : SESSION_REQUEST_STATUS.CHANGES_REQUESTED,
        review_feedback: data.feedback?.trim() || null,
        reviewed_at: now,
        reviewed_by: lecturerId,
      })
      .eq("id", data.claimId);

    if (upErr) throw new Error(upErr.message);

    if (data.decision === "CHANGES_REQUESTED" && data.feedback?.trim()) {
      await supabase.from("notifications").insert({
        recipient_id: row.tutor_id as string,
        claim_id: data.claimId,
        channel: "IN_APP",
        type: "SYSTEM",
        subject: "Session request — changes requested",
        body: data.feedback.trim(),
      });
    }

    return { ok: true };
  });
