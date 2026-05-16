import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import { scheduleClaimTimesFromTimestamps } from "#/lib/schedule-claim-times";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { reviewChangeSchema } from "./schemas";

export const adminReviewScheduleChangeRequestFn = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => reviewChangeSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);

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
        proposed_venue_text,
        session:scheduled_sessions!inner (
          module_id,
          modules!inner ( institution_id )
        )
      `,
      )
      .eq("id", data.requestId)
      .single();

    if (reqErr) throw new Error(reqErr.message);

    const session = req.session as unknown as {
      module_id: string;
      modules: { institution_id: string };
    } | null;

    if (!session || session.modules.institution_id !== institutionId) {
      throw new Error("Request not found or access denied.");
    }

    if (req.status !== "PENDING") {
      throw new Error("This request has already been reviewed.");
    }

    const { error: updReqErr } = await supabase
      .from("schedule_change_requests")
      .update({
        status: data.decision,
        reviewed_by: userId,
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
