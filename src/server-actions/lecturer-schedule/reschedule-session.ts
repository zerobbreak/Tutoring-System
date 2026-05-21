import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import {
  loadScheduledSessionSnapshot,
  syncScheduledSessionAfterUpdate,
} from "#/lib/schedule-sync";
import { createSupabaseServerClient } from "#/lib/supabase-server";

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
    const lecturerId = await requireLecturerId(supabase);

    const before = await loadScheduledSessionSnapshot(
      supabase,
      data.scheduledSessionId,
    );
    if (!before) throw new Error("Session not found.");

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

    await syncScheduledSessionAfterUpdate(supabase, {
      scheduledSessionId: data.scheduledSessionId,
      actorId: lecturerId,
      before,
    });

    return { ok: true };
  });
