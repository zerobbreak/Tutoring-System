import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { snapshotClaimCompensation } from "#/lib/snapshot-claim-compensation";
import { assertClaimNotFrozen } from "./assert-claim-not-frozen";
import type { AdminApprovalActionKind } from "./types";

const actionSchema = z.object({
  claimId: z.string().uuid(),
  action: z.enum([
    "APPROVE",
    "REJECT",
    "REQUEST_CLARIFICATION",
    "ESCALATE",
    "FREEZE",
  ]),
  comment: z.string().max(2000).optional(),
});

type ActionConfig = {
  actionType: string;
  nextStatus?: ClaimStatus;
  requiresComment?: boolean;
  setFrozen?: boolean;
  updateDispute?: boolean;
};

const ACTION_MAP: Record<AdminApprovalActionKind, ActionConfig> = {
  APPROVE: { actionType: "ADMIN_APPROVED", nextStatus: "APPROVED" },
  REJECT: {
    actionType: "ADMIN_REJECTED",
    nextStatus: "REJECTED",
    requiresComment: true,
  },
  REQUEST_CLARIFICATION: {
    actionType: "CLARIFICATION_REQUESTED",
    nextStatus: "PENDING_VERIFICATION",
  },
  ESCALATE: {
    actionType: "ESCALATED",
    requiresComment: true,
    updateDispute: true,
  },
  FREEZE: { actionType: "FROZEN", setFrozen: true },
};

export const performAdminApprovalActionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => actionSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { userId } = await requireAdminContext(supabase);

    const config = ACTION_MAP[data.action];
    const comment = data.comment?.trim() || null;

    if (config.requiresComment && !comment) {
      throw new Error("A comment is required for this action.");
    }

    const { data: claim, error: selErr } = await supabase
      .from("session_claims")
      .select("id, status, module_id, frozen_at")
      .eq("id", data.claimId)
      .maybeSingle();

    if (selErr) throw new Error(selErr.message);
    if (!claim) throw new Error("Claim not found.");

    const fromStatus = claim.status as ClaimStatus;
    const frozenAt = claim.frozen_at as string | null;

    if (data.action !== "FREEZE") {
      assertClaimNotFrozen(frozenAt, data.action.toLowerCase());
    } else if (frozenAt) {
      throw new Error("This claim is already frozen.");
    }

    if (data.action === "APPROVE" && fromStatus !== "VERIFIED") {
      throw new Error("Only lecturer-verified claims can be admin-approved.");
    }

    if (
      data.action === "REJECT" &&
      !["VERIFIED", "DISPUTED"].includes(fromStatus)
    ) {
      throw new Error(`Cannot reject a claim with status ${fromStatus}.`);
    }

    if (data.action === "REQUEST_CLARIFICATION" && fromStatus !== "VERIFIED") {
      throw new Error("Clarification can only be requested on verified claims.");
    }

    if (data.action === "ESCALATE" && fromStatus !== "DISPUTED") {
      throw new Error("Escalation applies to disputed claims only.");
    }

    const updates: Record<string, unknown> = {};
    if (config.setFrozen) {
      updates.frozen_at = new Date().toISOString();
    }
    if (config.nextStatus) {
      updates.status = config.nextStatus;
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from("session_claims")
        .update(updates)
        .eq("id", data.claimId);

      if (upErr) throw new Error(upErr.message);
    }

    if (config.updateDispute && comment) {
      const { error: dErr } = await supabase
        .from("disputes")
        .update({
          resolution_note: comment,
        })
        .eq("claim_id", data.claimId)
        .eq("status", "OPEN");

      if (dErr) throw new Error(dErr.message);
    }

    const toStatus = (config.nextStatus ?? fromStatus) as ClaimStatus;

    const { error: actErr } = await supabase.from("verification_actions").insert({
      claim_id: data.claimId,
      actor_id: userId,
      action_type: config.actionType,
      from_status: fromStatus,
      to_status: toStatus,
      comment,
      mfa_confirmed: false,
      mfa_method: null,
    });

    if (actErr) throw new Error(actErr.message);

    if (data.action === "APPROVE") {
      const admin = getSupabaseAdmin();
      if (admin) {
        await snapshotClaimCompensation(admin, data.claimId);
      } else {
        await snapshotClaimCompensation(supabase, data.claimId);
      }
    }

    return {
      ok: true as const,
      status: toStatus,
      frozen: Boolean(config.setFrozen),
    };
  });
