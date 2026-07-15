import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { SESSION_REQUEST_STATUS } from "#/lib/session-request-status";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { isTutorManualSessionClaim } from "#/lib/tutor-manual-session-claim";
import {
  parseSessionClockTimes,
  requireUserId,
} from "#/server-actions/tutor-sessions/helpers";

const resubmitSessionRequestSchema = z.object({
  claimId: z.string().uuid(),
  moduleId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  venue: z.string().max(255).optional(),
  sessionKind: z.string().max(50).optional(),
  requestReason: z.string().min(10).max(2000),
});

/** Update and resubmit a session request after lecturer/admin requested changes. */
export const resubmitSessionRequestFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => resubmitSessionRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: existing, error: selErr } = await supabase
      .from("session_claims")
      .select(
        "id, request_status, source_scheduled_session_id, source_schedule_import_id",
      )
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!existing) throw new Error("Session not found.");
    if (!isTutorManualSessionClaim(existing)) {
      throw new Error("Only session requests can be resubmitted.");
    }
    if (existing.request_status !== SESSION_REQUEST_STATUS.CHANGES_REQUESTED) {
      throw new Error("This request is not awaiting changes from you.");
    }

    const { start_time, end_time, hours } = parseSessionClockTimes(
      data.sessionDate,
      data.startTime,
      data.endTime,
    );
    const venue =
      data.venue?.trim() === "" ? null : (data.venue?.trim() ?? null);

    const { error: upErr } = await supabase
      .from("session_claims")
      .update({
        module_id: data.moduleId,
        session_date: data.sessionDate,
        start_time,
        end_time,
        hours,
        venue,
        session_kind: data.sessionKind?.trim() || "tutorial",
        request_reason: data.requestReason.trim(),
        request_status: SESSION_REQUEST_STATUS.PENDING,
        review_feedback: null,
        reviewed_at: null,
        reviewed_by: null,
      })
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId);

    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });
