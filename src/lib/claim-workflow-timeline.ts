import type { ClaimStatus } from "#/lib/session-claim-display";
import type { createSupabaseServerClient } from "#/lib/supabase-server";

export const CLAIM_WORKFLOW_ACTION = {
  SESSION_CREATION_APPROVED: "SESSION_CREATION_APPROVED",
  TUTOR_SUBMITTED: "TUTOR_SUBMITTED",
  TUTOR_RESUBMITTED: "TUTOR_RESUBMITTED",
} as const;

export type WorkflowActor = {
  id: string;
  full_name: string;
  email: string;
} | null;

export type WorkflowTimelineEntry = {
  id: string;
  claim_id: string;
  actor_id: string;
  actor: WorkflowActor;
  action_type: string;
  from_status: ClaimStatus | null;
  to_status: ClaimStatus | null;
  comment: string | null;
  acted_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  [CLAIM_WORKFLOW_ACTION.SESSION_CREATION_APPROVED]: "Session approved by admin",
  [CLAIM_WORKFLOW_ACTION.TUTOR_SUBMITTED]: "Submitted for verification",
  [CLAIM_WORKFLOW_ACTION.TUTOR_RESUBMITTED]: "Resubmitted for verification",
  APPROVED: "Approved by lecturer",
  SIGNED_APPROVAL: "Signed approval",
  REJECTED: "Rejected",
  DISPUTED: "Disputed",
  CLARIFICATION_REQUESTED: "Clarification requested",
  ADMIN_APPROVED: "Approved by admin",
  ADMIN_REJECTED: "Rejected by admin",
  ESCALATED: "Escalated",
  FROZEN: "Frozen",
};

export function formatWorkflowActionLabel(actionType: string): string {
  return (
    ACTION_LABELS[actionType] ??
    actionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export async function appendClaimWorkflowEvent(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  params: {
    claimId: string;
    actorId: string;
    actionType: string;
    fromStatus: ClaimStatus | null;
    toStatus: ClaimStatus | null;
    comment?: string | null;
    mfaConfirmed?: boolean;
    mfaMethod?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("verification_actions").insert({
    claim_id: params.claimId,
    actor_id: params.actorId,
    action_type: params.actionType,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    comment: params.comment ?? null,
    mfa_confirmed: params.mfaConfirmed ?? false,
    mfa_method: params.mfaMethod ?? null,
  });

  if (error) throw new Error(error.message);
}

type BuildTimelineInput = {
  claimId: string;
  tutorId: string;
  tutorActor: WorkflowActor;
  submittedAt: string | null;
  adminCreationApprovedAt: string | null;
  adminCreationApprover: WorkflowActor;
  isManualSession: boolean;
  stored: WorkflowTimelineEntry[];
};

/** Merge DB events with synthetic steps when older data has no verification_actions row. */
export function buildClaimWorkflowTimeline(
  input: BuildTimelineInput,
): WorkflowTimelineEntry[] {
  const events = [...input.stored];

  const hasAction = (type: string) =>
    events.some((e) => e.action_type === type);

  if (
    input.isManualSession &&
    input.adminCreationApprovedAt &&
    !hasAction(CLAIM_WORKFLOW_ACTION.SESSION_CREATION_APPROVED)
  ) {
    events.push({
      id: `synthetic-creation-approved-${input.claimId}`,
      claim_id: input.claimId,
      actor_id: input.adminCreationApprover?.id ?? "",
      actor: input.adminCreationApprover,
      action_type: CLAIM_WORKFLOW_ACTION.SESSION_CREATION_APPROVED,
      from_status: "DRAFT",
      to_status: "DRAFT",
      comment: null,
      acted_at: input.adminCreationApprovedAt,
    });
  }

  if (input.submittedAt && !hasAction(CLAIM_WORKFLOW_ACTION.TUTOR_SUBMITTED)) {
    events.push({
      id: `synthetic-submitted-${input.claimId}`,
      claim_id: input.claimId,
      actor_id: input.tutorId,
      actor: input.tutorActor,
      action_type: CLAIM_WORKFLOW_ACTION.TUTOR_SUBMITTED,
      from_status: "DRAFT",
      to_status: "PENDING_VERIFICATION",
      comment: null,
      acted_at: input.submittedAt,
    });
  }

  return events.sort(
    (a, b) => new Date(b.acted_at).getTime() - new Date(a.acted_at).getTime(),
  );
}
