import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import {
  assertNoSchedulingConflicts,
  getModuleInstitutionId,
} from "#/lib/schedule-conflicts-assert";
import type { ScheduleSessionLike } from "#/lib/schedule-conflicts";
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
  .validator((input: unknown) => rescheduleSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const before = await loadScheduledSessionSnapshot(
      supabase,
      data.scheduledSessionId,
    );
    if (!before) throw new Error("Session not found.");

    const institutionId = await getModuleInstitutionId(supabase, before.moduleId);
    const proposed: ScheduleSessionLike = {
      id: data.scheduledSessionId,
      tutorId: before.tutorId,
      tutorName: before.moduleCode,
      moduleId: before.moduleId,
      moduleCode: before.moduleCode,
      venueId: data.venueId ?? before.venueId,
      venueName: data.venueText ?? before.venueText ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      status: "RESCHEDULED",
    };
    await assertNoSchedulingConflicts(supabase, {
      institutionId,
      proposedSessions: [proposed],
    });

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
