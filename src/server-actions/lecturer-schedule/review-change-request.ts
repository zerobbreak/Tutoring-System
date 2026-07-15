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

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const reviewScheduleChangeRequestFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => reviewSchema.parse(input))
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

    const sessionId = req.scheduled_session_id as string;
    const before = await loadScheduledSessionSnapshot(supabase, sessionId);
    if (!before) throw new Error("Scheduled session not found.");

    const institutionId = await getModuleInstitutionId(supabase, before.moduleId);
    const proposed: ScheduleSessionLike = {
      id: sessionId,
      tutorId: before.tutorId,
      moduleId: before.moduleId,
      moduleCode: before.moduleCode,
      venueId: (req.proposed_venue_id as string | null) ?? before.venueId,
      startsAt: req.proposed_starts_at as string,
      endsAt: req.proposed_ends_at as string,
      status: "RESCHEDULED",
    };
    await assertNoSchedulingConflicts(supabase, {
      institutionId,
      proposedSessions: [proposed],
    });

    const { error: sessErr } = await supabase
      .from("scheduled_sessions")
      .update({
        starts_at: req.proposed_starts_at,
        ends_at: req.proposed_ends_at,
        venue_id: req.proposed_venue_id,
        venue_text: req.proposed_venue_text,
        status: "RESCHEDULED",
      })
      .eq("id", sessionId);

    if (sessErr) throw new Error(sessErr.message);

    await syncScheduledSessionAfterUpdate(supabase, {
      scheduledSessionId: sessionId,
      actorId: lecturerId,
      before,
    });

    return { ok: true };
  });
