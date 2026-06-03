import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClaimStatus } from "#/lib/session-claim-display";
import { requireStepUpMfa, type StepUpMfaLogFn } from "#/lib/mfa-auth-server";
import {
  adminActionAllowedFromStatuses,
  getActionConfig,
  lecturerActionAllowedFromStatuses,
  lecturerActionRequiresPendingStatus,
} from "./actions";
import {
  assertClaimNotFrozen,
  assertStatusIn,
} from "./guards";
import { assertTransitionAllowed } from "./transitions";
import type {
  AttestationMethod,
  ClaimWorkflowAction,
  VerificationActionInsert,
  WorkflowActorRole,
} from "./types";
import { isAdminWorkflowRole } from "./types";

export type ClaimRow = {
  id: string;
  status: ClaimStatus;
  module_id: string;
  frozen_at: string | null;
};

export type ExecuteTransitionInput = {
  claimId: string;
  action: ClaimWorkflowAction;
  actor: { userId: string; role: string };
  comment?: string | null;
  stepUpCode?: string;
  logStepUpMfa?: StepUpMfaLogFn;
};

export type ExecuteTransitionResult = {
  ok: true;
  status: ClaimStatus;
  frozen: boolean;
  fromStatus: ClaimStatus;
};

function actionLabel(action: ClaimWorkflowAction): string {
  return action.toLowerCase().replace(/_/g, " ");
}

const LECTURER_ONLY_ACTIONS = new Set([
  "APPROVE",
  "REJECT",
  "DISPUTE",
  "REQUEST_CLARIFICATION",
]);

const ADMIN_ONLY_ACTIONS = new Set(["ESCALATE", "FREEZE"]);

const ADMIN_APPROVAL_ACTIONS = new Set([
  "APPROVE",
  "REJECT",
  "REQUEST_CLARIFICATION",
]);

function assertRoleForAction(
  action: ClaimWorkflowAction,
  role: string,
): WorkflowActorRole {
  if (action === "SUBMIT" || action === "REOPEN") {
    if (role !== "TUTOR") throw new Error("Only tutors can perform this action.");
    return "TUTOR";
  }

  if (ADMIN_ONLY_ACTIONS.has(action)) {
    if (!isAdminWorkflowRole(role)) {
      throw new Error("Only administrators can perform this action.");
    }
    return role as WorkflowActorRole;
  }

  if (ADMIN_APPROVAL_ACTIONS.has(action) && isAdminWorkflowRole(role)) {
    return role as WorkflowActorRole;
  }

  if (LECTURER_ONLY_ACTIONS.has(action)) {
    if (role !== "LECTURER") {
      throw new Error("Only lecturers can perform verification actions.");
    }
    return "LECTURER";
  }

  throw new Error("You do not have permission to perform this action.");
}

export async function executeClaimTransition(
  supabase: SupabaseClient,
  input: ExecuteTransitionInput,
): Promise<ExecuteTransitionResult> {
  const { claimId, action, actor, comment: rawComment, stepUpCode, logStepUpMfa } =
    input;
  const config = getActionConfig(action, actor.role);
  const comment = rawComment?.trim() || null;

  assertRoleForAction(action, actor.role);

  if (config.requiresComment && !comment) {
    throw new Error("A comment is required for this action.");
  }

  const { data: claim, error: selErr } = await supabase
    .from("session_claims")
    .select("id, status, module_id, frozen_at")
    .eq("id", claimId)
    .maybeSingle();

  if (selErr) throw new Error(selErr.message);
  if (!claim) throw new Error("Claim not found.");

  const fromStatus = claim.status as ClaimStatus;
  const frozenAt = claim.frozen_at as string | null;

  if (action !== "FREEZE") {
    assertClaimNotFrozen(frozenAt, actionLabel(action));
  } else if (frozenAt) {
    throw new Error("This claim is already frozen.");
  }

  if (actor.role === "LECTURER" && LECTURER_ONLY_ACTIONS.has(action)) {
    const lecturerAction = action as
      | "APPROVE"
      | "REJECT"
      | "DISPUTE"
      | "REQUEST_CLARIFICATION";
    if (lecturerActionRequiresPendingStatus(lecturerAction)) {
      assertStatusIn(
        fromStatus,
        lecturerActionAllowedFromStatuses(lecturerAction),
        `Cannot ${action.toLowerCase()} a claim with status {status}.`,
      );
    }
  }

  if (isAdminWorkflowRole(actor.role)) {
    const allowed = adminActionAllowedFromStatuses(
      action as "APPROVE" | "REJECT" | "REQUEST_CLARIFICATION" | "ESCALATE" | "FREEZE",
    );
    if (allowed) {
      assertStatusIn(
        fromStatus,
        allowed,
        `Cannot ${action.toLowerCase()} a claim with status {status}.`,
      );
    }
  }

  if (action === "SUBMIT" && fromStatus !== "DRAFT") {
    throw new Error("Only draft claims can be submitted.");
  }

  if (action === "REOPEN" && !["REJECTED", "DISPUTED"].includes(fromStatus)) {
    throw new Error("Only rejected or disputed claims can be reopened for correction.");
  }

  const toStatus = (config.nextStatus ?? fromStatus) as ClaimStatus;

  if (config.nextStatus) {
    assertTransitionAllowed(fromStatus, toStatus, actor.role);
  }

  if (config.requiresStepUpMfa) {
    await requireStepUpMfa(
      supabase,
      stepUpCode,
      actionLabel(action),
      logStepUpMfa,
    );
  }

  const attestationMethod: AttestationMethod = config.requiresStepUpMfa
    ? "TOTP_STEP_UP"
    : "NONE";

  const updates: Record<string, unknown> = {};
  if (config.setFrozen) {
    updates.frozen_at = new Date().toISOString();
  }
  if (config.nextStatus) {
    updates.status = config.nextStatus;
  }
  if (config.clearsSubmittedAt) {
    updates.submitted_at = null;
  }
  if (action === "SUBMIT") {
    updates.submitted_at = new Date().toISOString();
  }

  if (Object.keys(updates).length > 0) {
    const { error: upErr } = await supabase
      .from("session_claims")
      .update(updates)
      .eq("id", claimId);

    if (upErr) throw new Error(upErr.message);
  }

  if (config.createDispute && comment) {
    const { error: dErr } = await supabase.from("disputes").insert({
      claim_id: claimId,
      raised_by_id: actor.userId,
      reason: comment,
      status: "OPEN",
    });
    if (dErr) throw new Error(dErr.message);
  }

  if (config.updateDispute && comment) {
    const { error: dErr } = await supabase
      .from("disputes")
      .update({ resolution_note: comment })
      .eq("claim_id", claimId)
      .eq("status", "OPEN");

    if (dErr) throw new Error(dErr.message);
  }

  const verificationRow: VerificationActionInsert = {
    claim_id: claimId,
    actor_id: actor.userId,
    action_type: config.actionType,
    from_status: fromStatus,
    to_status: toStatus,
    comment,
    mfa_confirmed: attestationMethod === "TOTP_STEP_UP",
    mfa_method: attestationMethod === "TOTP_STEP_UP" ? "TOTP_STEP_UP" : null,
    attestation_method: attestationMethod,
  };

  const { error: actErr } = await supabase
    .from("verification_actions")
    .insert(verificationRow);

  if (actErr) throw new Error(actErr.message);

  return {
    ok: true,
    status: toStatus,
    frozen: Boolean(config.setFrozen),
    fromStatus,
  };
}
