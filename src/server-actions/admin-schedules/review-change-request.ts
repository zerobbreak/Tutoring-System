import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext } from "#/lib/admin-server";
import {
  assertNoSchedulingConflicts,
} from "#/lib/schedule-conflicts-assert";
import type { ScheduleSessionLike } from "#/lib/schedule-conflicts";
import {
  loadScheduledSessionSnapshot,
  syncScheduledSessionAfterUpdate,
} from "#/lib/schedule-sync";
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

    const sessionId = req.scheduled_session_id as string;
    const before = await loadScheduledSessionSnapshot(supabase, sessionId);
    if (!before) throw new Error("Scheduled session not found.");

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
      actorId: userId,
      before,
    });

    return { ok: true };
  });
