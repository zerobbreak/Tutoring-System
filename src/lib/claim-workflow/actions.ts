import type { ClaimStatus } from "#/lib/session-claim-display";
import type {
  AdminWorkflowAction,
  ClaimWorkflowAction,
  LecturerWorkflowAction,
  TutorWorkflowAction,
} from "./types";

export type ActionConfig = {
  actionType: string;
  nextStatus?: ClaimStatus;
  requiresComment?: boolean;
  createDispute?: boolean;
  updateDispute?: boolean;
  setFrozen?: boolean;
  clearsSubmittedAt?: boolean;
  requiresStepUpMfa?: boolean;
};

const LECTURER_ACTION_MAP: Record<LecturerWorkflowAction, ActionConfig> = {
  APPROVE: { actionType: "APPROVED", nextStatus: "VERIFIED", requiresStepUpMfa: true },
  REJECT: {
    actionType: "REJECTED",
    nextStatus: "REJECTED",
    requiresComment: true,
    requiresStepUpMfa: true,
  },
  DISPUTE: {
    actionType: "DISPUTED",
    nextStatus: "DISPUTED",
    requiresComment: true,
    createDispute: true,
    requiresStepUpMfa: true,
  },
  REQUEST_CLARIFICATION: {
    actionType: "CLARIFICATION_REQUESTED",
    requiresStepUpMfa: true,
  },
};

const ADMIN_ACTION_MAP: Record<AdminWorkflowAction, ActionConfig> = {
  APPROVE: { actionType: "ADMIN_APPROVED", nextStatus: "APPROVED", requiresStepUpMfa: true },
  REJECT: {
    actionType: "ADMIN_REJECTED",
    nextStatus: "REJECTED",
    requiresComment: true,
    requiresStepUpMfa: true,
  },
  REQUEST_CLARIFICATION: {
    actionType: "CLARIFICATION_REQUESTED",
    nextStatus: "PENDING_VERIFICATION",
    requiresStepUpMfa: true,
  },
  ESCALATE: {
    actionType: "ESCALATED",
    requiresComment: true,
    updateDispute: true,
    requiresStepUpMfa: true,
  },
  FREEZE: { actionType: "FROZEN", setFrozen: true, requiresStepUpMfa: true },
};

const TUTOR_ACTION_MAP: Record<TutorWorkflowAction, ActionConfig> = {
  SUBMIT: {
    actionType: "SUBMITTED",
    nextStatus: "PENDING_VERIFICATION",
    requiresStepUpMfa: true,
  },
  REOPEN: {
    actionType: "REOPENED",
    nextStatus: "DRAFT",
    clearsSubmittedAt: true,
    requiresStepUpMfa: true,
  },
};

export function getActionConfig(
  action: ClaimWorkflowAction,
  role: string,
): ActionConfig {
  if (action === "SUBMIT" || action === "REOPEN") {
    return TUTOR_ACTION_MAP[action];
  }

  if (role === "LECTURER") {
    return LECTURER_ACTION_MAP[action as LecturerWorkflowAction];
  }

  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return ADMIN_ACTION_MAP[action as AdminWorkflowAction];
  }

  throw new Error("Unsupported action for this role.");
}

export function lecturerActionRequiresPendingStatus(
  action: LecturerWorkflowAction,
): boolean {
  return action !== "REQUEST_CLARIFICATION";
}

export function lecturerActionAllowedFromStatuses(
  action: LecturerWorkflowAction,
): ClaimStatus[] {
  if (action === "REQUEST_CLARIFICATION") {
    return ["PENDING_VERIFICATION", "DISPUTED"];
  }
  return ["PENDING_VERIFICATION", "DISPUTED"];
}

export function adminActionAllowedFromStatuses(
  action: AdminWorkflowAction,
): ClaimStatus[] | null {
  switch (action) {
    case "APPROVE":
      return ["VERIFIED"];
    case "REJECT":
      return ["VERIFIED", "DISPUTED"];
    case "REQUEST_CLARIFICATION":
      return ["VERIFIED"];
    case "ESCALATE":
      return ["DISPUTED"];
    case "FREEZE":
      return null;
    default:
      return null;
  }
}
