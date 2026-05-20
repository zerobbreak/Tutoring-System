import type { ClaimStatus } from "#/lib/session-claim-display";
import type { UserRole } from "#/lib/user-role";

/** Roles that may drive claim status transitions. */
export type WorkflowActorRole = Extract<
  UserRole,
  "TUTOR" | "LECTURER" | "ADMIN" | "SUPER_ADMIN"
>;

export function isAdminWorkflowRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export type TutorWorkflowAction = "SUBMIT" | "REOPEN";

export type LecturerWorkflowAction =
  | "APPROVE"
  | "REJECT"
  | "DISPUTE"
  | "REQUEST_CLARIFICATION";

export type AdminWorkflowAction =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_CLARIFICATION"
  | "ESCALATE"
  | "FREEZE";

export type ClaimWorkflowAction =
  | TutorWorkflowAction
  | LecturerWorkflowAction
  | AdminWorkflowAction;

export type StatusTransition = {
  from: ClaimStatus;
  to: ClaimStatus;
  roles: WorkflowActorRole[];
};

export type AttestationMethod = "NONE" | "TOTP_STEP_UP";

export type VerificationActionInsert = {
  claim_id: string;
  actor_id: string;
  action_type: string;
  from_status: ClaimStatus;
  to_status: ClaimStatus;
  comment: string | null;
  mfa_confirmed: boolean;
  mfa_method: string | null;
  attestation_method: AttestationMethod;
};
