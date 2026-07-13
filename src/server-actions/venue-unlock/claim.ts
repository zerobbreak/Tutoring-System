import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logInstitutionAudit } from "#/lib/audit-log";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUnlockResponderContext } from "#/lib/venue-unlock-server";
import {
  formatUnlockSessionLabel,
  loadUnlockSessionContext,
} from "./helpers";

const schema = z.object({
  scheduledSessionId: z.string().uuid(),
});

export const claimVenueUnlockFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireUnlockResponderContext(supabase);

    const sessionCtx = await loadUnlockSessionContext(
      supabase,
      data.scheduledSessionId,
      ctx.institutionId,
    );

    const now = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("venue_unlock_requests")
      .update({
        status: "CLAIMED",
        claimed_by: ctx.userId,
        claimed_at: now,
        urgent_at: null,
      })
      .eq("scheduled_session_id", data.scheduledSessionId)
      .eq("institution_id", ctx.institutionId)
      .in("status", ["PENDING", "URGENT"])
      .is("claimed_by", null)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!updated?.id) {
      const { data: existing } = await supabase
        .from("venue_unlock_requests")
        .select("claimed_by, users!venue_unlock_requests_claimed_by_fkey(full_name)")
        .eq("scheduled_session_id", data.scheduledSessionId)
        .maybeSingle();

      const claimant = existing?.users as { full_name: string } | null;
      if (claimant?.full_name) {
        throw new Error(`Already claimed by ${claimant.full_name}.`);
      }
      throw new Error("This unlock request is no longer available to claim.");
    }

    const label = formatUnlockSessionLabel({
      moduleCode: sessionCtx.moduleCode,
      venueName: sessionCtx.venueName,
      startsAt: sessionCtx.startsAt,
    });

    const { data: responder } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", ctx.userId)
      .single();

    const responderName = (responder?.full_name as string) ?? "A staff member";

    await supabase.from("notifications").insert({
      recipient_id: sessionCtx.tutorId,
      claim_id: sessionCtx.claimId,
      channel: "IN_APP",
      type: "VENUE_UNLOCK_CLAIMED",
      subject: `${sessionCtx.venueName} opening claimed`,
      body: `${responderName} is on their way to open ${sessionCtx.venueName} for your session (${sessionCtx.moduleCode}).`,
    });

    await logInstitutionAudit(supabase, {
      institutionId: ctx.institutionId,
      actorId: ctx.userId,
      entityType: "VENUE_UNLOCK_REQUEST",
      entityId: updated.id as string,
      event: "VENUE_UNLOCK_CLAIMED",
      payload: {
        scheduled_session_id: data.scheduledSessionId,
        label,
      },
    });

    return { ok: true as const };
  });
