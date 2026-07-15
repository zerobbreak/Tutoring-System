import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { appendClaimWorkflowEvent } from "#/lib/claim-workflow-timeline";
import type { ClaimStatus } from "#/lib/session-kanban-column";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertClaimNotFrozen } from "#/server-actions/admin-approvals/assert-claim-not-frozen";
import { requireStepUpMfa } from "#/lib/mfa-auth-server";
import { isTutorSessionClaimVisible } from "#/lib/tutor-manual-session-claim";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";

const reopenClaimSchema = z.object({
  claimId: z.string().uuid(),
  stepUpCode: z.string().optional(),
});

/** Reopen a rejected/disputed claim so the tutor can correct and resubmit it. */
export const reopenSessionClaimFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => reopenClaimSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: row, error: selErr } = await supabase
      .from("session_claims")
      .select(
        "id, status, frozen_at, source_scheduled_session_id, source_schedule_import_id, admin_creation_approved_at",
      )
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Session not found.");
    if (!isTutorSessionClaimVisible(row)) {
      throw new Error(
        "This session is awaiting approval before you can work on it.",
      );
    }

    const fromStatus = row.status as ClaimStatus;
    if (fromStatus !== "REJECTED" && fromStatus !== "DISPUTED") {
      throw new Error(
        "Only rejected or disputed claims can be reopened for correction.",
      );
    }
    assertClaimNotFrozen(row.frozen_at as string | null, "reopen this session");
    await requireStepUpMfa(supabase, data.stepUpCode, "reopen this session");

    const { error: upErr } = await supabase
      .from("session_claims")
      .update({
        status: "DRAFT",
        submitted_at: null,
      })
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId);

    if (upErr) throw new Error(upErr.message);

    await appendClaimWorkflowEvent(supabase, {
      claimId: data.claimId,
      actorId: tutorId,
      actionType: "REOPENED",
      fromStatus,
      toStatus: "DRAFT",
      mfaConfirmed: true,
      mfaMethod: "TOTP_STEP_UP",
    });

    return { ok: true as const };
  });
