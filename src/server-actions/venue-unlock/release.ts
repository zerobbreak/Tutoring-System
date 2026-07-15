import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUnlockResponderContext } from "#/lib/venue-unlock-server";
import {
  loadUnlockSessionContext,
  notifyUnlockResponders,
} from "./helpers";

const schema = z.object({
  scheduledSessionId: z.string().uuid(),
});

export const releaseVenueUnlockFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    let ctx: { userId: string; institutionId: string; isAdmin: boolean };
    try {
      ctx = await requireUnlockResponderContext(supabase);
    } catch {
      const adminCtx = await requireAdminContext(supabase);
      ctx = {
        userId: adminCtx.userId,
        institutionId: adminCtx.institutionId,
        isAdmin: true,
      };
    }

    const sessionCtx = await loadUnlockSessionContext(
      supabase,
      data.scheduledSessionId,
      ctx.institutionId,
    );

    const { data: existing, error: fetchErr } = await supabase
      .from("venue_unlock_requests")
      .select("id, claimed_by, status")
      .eq("scheduled_session_id", data.scheduledSessionId)
      .eq("institution_id", ctx.institutionId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing?.id) throw new Error("Unlock request not found.");
    if (existing.status !== "CLAIMED") {
      throw new Error("Only claimed requests can be released.");
    }

    if (
      !ctx.isAdmin &&
      existing.claimed_by !== ctx.userId
    ) {
      throw new Error("You can only release your own claim.");
    }

    const { error } = await supabase
      .from("venue_unlock_requests")
      .update({
        status: "PENDING",
        claimed_by: null,
        claimed_at: null,
      })
      .eq("id", existing.id as string);

    if (error) throw new Error(error.message);

    await notifyUnlockResponders(supabase, {
      institutionId: ctx.institutionId,
      type: "VENUE_UNLOCK_RELEASED",
      subject: `${sessionCtx.venueName} unlock available again`,
      body: `The opening claim for ${sessionCtx.moduleCode} at ${sessionCtx.venueName} was released — someone still needs to open the room.`,
      excludeUserId: ctx.userId,
    });

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "VENUE_UNLOCK_REQUEST",
      entityId: existing.id as string,
      event: "VENUE_UNLOCK_RELEASED",
      payload: { scheduled_session_id: data.scheduledSessionId },
    });

    return { ok: true as const };
  });
