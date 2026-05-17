export const ONBOARDING_DOCUMENT_KINDS = [
  "government_id",
  "employment_confirmation",
] as const;

export type OnboardingDocumentKind = (typeof ONBOARDING_DOCUMENT_KINDS)[number];

export const ONBOARDING_DOCUMENT_LABELS: Record<OnboardingDocumentKind, string> =
  {
    government_id: "Government-issued ID",
    employment_confirmation: "Employment confirmation",
  };

import {
  formatUserStatus,
  hasPlatformAccess,
  isPendingApproval,
  type OnboardingStep,
  type UserStatus,
} from "#/lib/user-status";

/** @deprecated Legacy DB enum; prefer `UserStatus`. */
export const USER_APPROVAL_STATUSES = [
  "pending_documents",
  "pending_review",
  "approved",
  "rejected",
] as const;

export type UserApprovalStatus = (typeof USER_APPROVAL_STATUSES)[number];

export function formatApprovalStatus(
  status: UserApprovalStatus | UserStatus | string,
  onboardingStep?: OnboardingStep | string | null,
): string {
  if (
    status === "PENDING_APPROVAL" ||
    status === "ACTIVE" ||
    status === "SUSPENDED" ||
    status === "REJECTED"
  ) {
    return formatUserStatus(status, onboardingStep);
  }
  switch (status) {
    case "pending_documents":
      return "Pending documents";
    case "pending_review":
      return "Pending review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

/** @deprecated Use `hasPlatformAccess(user_status)`. */
export function isUserFullyApproved(
  status: UserApprovalStatus | UserStatus | string | null | undefined,
): boolean {
  if (status === "ACTIVE") return true;
  return status === "approved";
}

export function canReviewOnboarding(
  userStatus: UserStatus | string,
): boolean {
  return isPendingApproval(userStatus);
}

export { hasPlatformAccess, isPendingApproval };
