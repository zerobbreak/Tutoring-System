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

export const USER_APPROVAL_STATUSES = [
  "pending_documents",
  "pending_review",
  "approved",
  "rejected",
] as const;

export type UserApprovalStatus = (typeof USER_APPROVAL_STATUSES)[number];

export function formatApprovalStatus(status: UserApprovalStatus | string): string {
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

export function isUserFullyApproved(
  status: UserApprovalStatus | string | null | undefined,
): boolean {
  return status === "approved";
}
