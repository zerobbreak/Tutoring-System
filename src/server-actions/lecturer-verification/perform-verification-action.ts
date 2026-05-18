import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { appendClaimWorkflowEvent } from "#/lib/claim-workflow-timeline";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertClaimNotFrozen } from "#/server-actions/admin-approvals/assert-claim-not-frozen";
import type { VerificationActionKind } from "./types";

const actionSchema = z.object({
  claimId: z.string().uuid(),
  action: z.enum([
    "APPROVE",
    "REJECT",
    "DISPUTE",
    "REQUEST_CLARIFICATION",
    "SIGN_AND_APPROVE",
  ]),
  comment: z.string().max(2000).optional(),
  signatureConfirmed: z.boolean().optional(),
});

type ActionConfig = {
  actionType: string;
  nextStatus?: ClaimStatus;
  requiresComment?: boolean;
  digitallySigned?: boolean;
  createDispute?: boolean;
};

const ACTION_MAP: Record<VerificationActionKind, ActionConfig> = {
  APPROVE: { actionType: "APPROVED", nextStatus: "VERIFIED" },
  SIGN_AND_APPROVE: {
    actionType: "SIGNED_APPROVAL",
    nextStatus: "APPROVED",
    digitallySigned: true,
  },
  REJECT: { actionType: "REJECTED", nextStatus: "REJECTED", requiresComment: true },
  DISPUTE: {
    actionType: "DISPUTED",
    nextStatus: "DISPUTED",
    requiresComment: true,
    createDispute: true,
  },
  REQUEST_CLARIFICATION: {
    actionType: "CLARIFICATION_REQUESTED",
  },
};

export const performVerificationActionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => actionSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);

    const config = ACTION_MAP[data.action];
    const comment = data.comment?.trim() || null;

    if (config.requiresComment && !comment) {
      throw new Error("A comment is required for this action.");
    }

    if (
      data.action === "SIGN_AND_APPROVE" &&
      !data.signatureConfirmed
    ) {
      throw new Error("Digital signature confirmation is required.");
    }

    const { data: claim, error: selErr } = await supabase
      .from("session_claims")
      .select("id, status, module_id, frozen_at")
      .eq("id", data.claimId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!claim) throw new Error("Claim not found.");

    const fromStatus = claim.status as ClaimStatus;
    assertClaimNotFrozen(claim.frozen_at as string | null);

    if (
      data.action !== "REQUEST_CLARIFICATION" &&
      !["PENDING_VERIFICATION", "DISPUTED"].includes(fromStatus)
    ) {
      throw new Error(
        `Cannot ${data.action.toLowerCase()} a claim with status ${fromStatus}.`,
      );
    }

    if (config.nextStatus) {
      const { error: upErr } = await supabase
        .from("session_claims")
        .update({ status: config.nextStatus })
        .eq("id", data.claimId);

      if (upErr) throw new Error(upErr.message);
    }

    if (config.createDispute && comment) {
      const { error: dErr } = await supabase.from("disputes").insert({
        claim_id: data.claimId,
        raised_by_id: lecturerId,
        reason: comment,
        status: "OPEN",
      });
      if (dErr) throw new Error(dErr.message);
    }

    await appendClaimWorkflowEvent(supabase, {
      claimId: data.claimId,
      actorId: lecturerId,
      actionType: config.actionType,
      fromStatus,
      toStatus: config.nextStatus ?? fromStatus,
      comment,
      mfaConfirmed: config.digitallySigned ?? false,
      mfaMethod: config.digitallySigned ? "LECTURER_SIGNATURE" : null,
    });

    return {
      ok: true as const,
      status: config.nextStatus ?? fromStatus,
    };
  });
