import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { scheduleClaimTimesFromTimestamps } from "#/lib/schedule-claim-times";

const rescheduleSchema = z.object({
  scheduledSessionId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  venueId: z.string().uuid().nullable().optional(),
  venueText: z.string().max(255).nullable().optional(),
});

export const rescheduleScheduledSessionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => rescheduleSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    await requireLecturerId(supabase);

    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);

    const { error: sessErr } = await supabase
      .from("scheduled_sessions")
      .update({
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        venue_id: data.venueId ?? null,
        venue_text: data.venueText?.trim() || null,
        status: "RESCHEDULED",
      })
      .eq("id", data.scheduledSessionId);

    if (sessErr) throw new Error(sessErr.message);

    const times = scheduleClaimTimesFromTimestamps(startsAt, endsAt);

    await supabase
      .from("session_claims")
      .update({
        session_date: times.session_date,
        start_time: times.start_time,
        end_time: times.end_time,
        hours: times.hours,
        venue: data.venueText?.trim() || null,
      })
      .eq("source_scheduled_session_id", data.scheduledSessionId)
      .in("status", ["DRAFT", "PENDING_VERIFICATION"]);

    return { ok: true };
  });
