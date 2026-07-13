import { createServerFn } from "@tanstack/react-start";
import { addMinutes, isAfter, parseISO } from "date-fns";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  getUnlockUrgentMinutesBefore,
  parseUnlockSchedulingSettings,
} from "#/lib/venue-access";
import { requireTutorIdForUnlockPing } from "#/lib/venue-unlock-server";
import {
  formatUnlockSessionLabel,
  loadUnlockSessionContext,
  notifyUnlockResponders,
} from "./helpers";

const schema = z.object({
  scheduledSessionId: z.string().uuid(),
});

export const tutorPingVenueUnlockFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireTutorIdForUnlockPing(supabase);

    const { data: session, error: sessErr } = await supabase
      .from("scheduled_sessions")
      .select("id, tutor_id, starts_at")
      .eq("id", data.scheduledSessionId)
      .is("deleted_at", null)
      .maybeSingle();

    if (sessErr) throw new Error(sessErr.message);
    if (!session) throw new Error("Session not found.");
    if (session.tutor_id !== ctx.userId) {
      throw new Error("You can only ping for your own sessions.");
    }

    const { data: institution } = await supabase
      .from("institutions")
      .select("scheduling_settings")
      .eq("id", ctx.institutionId)
      .single();

    const urgentMinutes = getUnlockUrgentMinutesBefore(
      parseUnlockSchedulingSettings(institution?.scheduling_settings),
    );

    const startsAt = parseISO(session.starts_at as string);
    const pingOpensAt = addMinutes(startsAt, -urgentMinutes);
    if (isAfter(pingOpensAt, new Date())) {
      throw new Error(
        `You can ping staff ${urgentMinutes} minutes before the session starts.`,
      );
    }

    const sessionCtx = await loadUnlockSessionContext(
      supabase,
      data.scheduledSessionId,
      ctx.institutionId,
    );

    const now = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("venue_unlock_requests")
      .update({
        status: "URGENT",
        urgent_at: now,
        claimed_by: null,
        claimed_at: null,
      })
      .eq("scheduled_session_id", data.scheduledSessionId)
      .eq("institution_id", ctx.institutionId)
      .in("status", ["PENDING", "CLAIMED", "URGENT"])
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!updated?.id) {
      throw new Error("No unlock request exists for this session.");
    }

    const label = formatUnlockSessionLabel({
      moduleCode: sessionCtx.moduleCode,
      venueName: sessionCtx.venueName,
      startsAt: sessionCtx.startsAt,
    });

    await notifyUnlockResponders(supabase, {
      institutionId: ctx.institutionId,
      type: "VENUE_UNLOCK_URGENT",
      subject: `URGENT: ${label}`,
      body: `A tutor is locked out — ${label}. Please open the room as soon as possible.`,
    });

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "VENUE_UNLOCK_REQUEST",
      entityId: updated.id as string,
      event: "VENUE_UNLOCK_URGENT",
      payload: { scheduled_session_id: data.scheduledSessionId },
    });

    return { ok: true as const };
  });
