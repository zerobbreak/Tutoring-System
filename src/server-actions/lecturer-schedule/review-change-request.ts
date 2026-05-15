import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { scheduleClaimTimesFromTimestamps } from "#/lib/schedule-claim-times";

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const reviewScheduleChangeRequestFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const { data: req, error: reqErr } = await supabase
      .from("schedule_change_requests")
      .select(
        `
        id,
        status,
        scheduled_session_id,
        proposed_starts_at,
        proposed_ends_at,
        proposed_venue_id,
        proposed_venue_text
      `,
      )
      .eq("id", data.requestId)
      .single();

    if (reqErr) throw new Error(reqErr.message);
    if (req.status !== "PENDING") {
      throw new Error("This request has already been reviewed.");
    }

    const { error: updReqErr } = await supabase
      .from("schedule_change_requests")
      .update({
        status: data.decision,
        reviewed_by: lecturerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);

    if (updReqErr) throw new Error(updReqErr.message);

    if (data.decision === "REJECTED") return { ok: true };

    const startsAt = new Date(req.proposed_starts_at as string);
    const endsAt = new Date(req.proposed_ends_at as string);

    const { error: sessErr } = await supabase
      .from("scheduled_sessions")
      .update({
        starts_at: req.proposed_starts_at,
        ends_at: req.proposed_ends_at,
        venue_id: req.proposed_venue_id,
        venue_text: req.proposed_venue_text,
        status: "RESCHEDULED",
      })
      .eq("id", req.scheduled_session_id as string);

    if (sessErr) throw new Error(sessErr.message);

    const times = scheduleClaimTimesFromTimestamps(startsAt, endsAt);
    const venue = (req.proposed_venue_text as string | null)?.trim() || null;

    await supabase
      .from("session_claims")
      .update({
        session_date: times.session_date,
        start_time: times.start_time,
        end_time: times.end_time,
        hours: times.hours,
        venue,
      })
      .eq("source_scheduled_session_id", req.scheduled_session_id as string)
      .in("status", ["DRAFT", "PENDING_VERIFICATION"]);

    return { ok: true };
  });
