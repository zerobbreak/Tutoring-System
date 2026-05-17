import type { ClaimStatus } from "#/lib/session-claim-display";
import type { StatusTransition, WorkflowActorRole } from "./types";
import { isAdminWorkflowRole } from "./types";

/**
 * Allowed status edges and which roles may perform them.
 * Keep in sync with supabase migration `claim_workflow_enforcement.sql`.
 */
export const STATUS_TRANSITIONS: readonly StatusTransition[] = [
  { from: "DRAFT", to: "PENDING_VERIFICATION", roles: ["TUTOR"] },
  { from: "REJECTED", to: "DRAFT", roles: ["TUTOR"] },
  { from: "DISPUTED", to: "DRAFT", roles: ["TUTOR"] },
  {
    from: "PENDING_VERIFICATION",
    to: "VERIFIED",
    roles: ["LECTURER"],
  },
  {
    from: "PENDING_VERIFICATION",
    to: "REJECTED",
    roles: ["LECTURER"],
  },
  {
    from: "PENDING_VERIFICATION",
    to: "DISPUTED",
    roles: ["LECTURER"],
  },
  { from: "DISPUTED", to: "VERIFIED", roles: ["LECTURER"] },
  { from: "DISPUTED", to: "REJECTED", roles: ["LECTURER"] },
  {
    from: "VERIFIED",
    to: "APPROVED",
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    from: "VERIFIED",
    to: "REJECTED",
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    from: "VERIFIED",
    to: "PENDING_VERIFICATION",
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    from: "DISPUTED",
    to: "REJECTED",
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
] as const;

/** Statuses where tutors may edit claim content (not status-only admin paths). */
export const TUTOR_EDITABLE_STATUSES: readonly ClaimStatus[] = [
  "DRAFT",
  "REJECTED",
  "DISPUTED",
];

export function isTransitionAllowed(
  from: ClaimStatus,
  to: ClaimStatus,
  role: string,
): boolean {
  const workflowRole = normalizeWorkflowRole(role);
  if (!workflowRole) return false;

  return STATUS_TRANSITIONS.some(
    (t) =>
      t.from === from &&
      t.to === to &&
      t.roles.includes(workflowRole),
  );
}

export function normalizeWorkflowRole(
  role: string,
): WorkflowActorRole | null {
  if (role === "TUTOR" || role === "LECTURER") return role;
  if (isAdminWorkflowRole(role)) return role as WorkflowActorRole;
  return null;
}

export function assertTransitionAllowed(
  from: ClaimStatus,
  to: ClaimStatus,
  role: string,
): void {
  if (!isTransitionAllowed(from, to, role)) {
    throw new Error(
      `Cannot change claim status from ${from} to ${to} with your role.`,
    );
  }
}
