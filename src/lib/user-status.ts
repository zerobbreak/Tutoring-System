/** Matches Postgres `CREATE TYPE user_status AS ENUM (...)` */
export const USER_STATUSES = [
  "PENDING_APPROVAL",
  "ACTIVE",
  "SUSPENDED",
  "REJECTED",
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const ONBOARDING_STEPS = ["documents", "ready_for_review"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isUserStatus(value: string): value is UserStatus {
  return (USER_STATUSES as readonly string[]).includes(value);
}

export function hasPlatformAccess(
  status: UserStatus | string | null | undefined,
): boolean {
  return status === "ACTIVE";
}

export function isPendingApproval(
  status: UserStatus | string | null | undefined,
): boolean {
  return status === "PENDING_APPROVAL";
}

export function isAccountBlocked(
  status: UserStatus | string | null | undefined,
): boolean {
  return status === "REJECTED" || status === "SUSPENDED";
}

export function formatUserStatus(
  status: UserStatus | string,
  onboardingStep?: OnboardingStep | string | null,
): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "SUSPENDED":
      return "Suspended";
    case "REJECTED":
      return "Rejected";
    case "PENDING_APPROVAL":
      if (onboardingStep === "ready_for_review") return "Pending approval";
      if (onboardingStep === "documents") return "Pending documents";
      return "Pending approval";
    default:
      return status;
  }
}

/** Row patch for service-role / admin writes (trigger syncs legacy columns). */
export function lifecycleRow(params: {
  userStatus: UserStatus;
  onboardingStep?: OnboardingStep | null;
}): {
  user_status: UserStatus;
  onboarding_step: OnboardingStep | null;
} {
  const { userStatus, onboardingStep = null } = params;
  if (userStatus === "PENDING_APPROVAL") {
    return {
      user_status: userStatus,
      onboarding_step: onboardingStep ?? "documents",
    };
  }
  return {
    user_status: userStatus,
    onboarding_step: null,
  };
}

export const PENDING_LIFECYCLE = lifecycleRow({
  userStatus: "PENDING_APPROVAL",
  onboardingStep: "documents",
});

export const PENDING_REVIEW_LIFECYCLE = lifecycleRow({
  userStatus: "PENDING_APPROVAL",
  onboardingStep: "ready_for_review",
});

export const ACTIVE_LIFECYCLE = lifecycleRow({ userStatus: "ACTIVE" });

export const SUSPENDED_LIFECYCLE = lifecycleRow({ userStatus: "SUSPENDED" });

export const REJECTED_LIFECYCLE = lifecycleRow({ userStatus: "REJECTED" });

/** Maps legacy `approval_status` + `is_active` when `user_status` column is unavailable. */
export function lifecycleFromLegacyUser(row: {
  approval_status?: string | null;
  is_active?: boolean | null;
}): {
  user_status: UserStatus;
  onboarding_step: OnboardingStep | null;
} {
  const approval = row.approval_status ?? "pending_documents";
  const isActive = row.is_active ?? true;

  if (approval === "rejected") {
    return { user_status: "REJECTED", onboarding_step: null };
  }
  if (approval === "approved" && !isActive) {
    return { user_status: "SUSPENDED", onboarding_step: null };
  }
  if (approval === "approved") {
    return { user_status: "ACTIVE", onboarding_step: null };
  }
  if (approval === "pending_review") {
    return {
      user_status: "PENDING_APPROVAL",
      onboarding_step: "ready_for_review",
    };
  }
  return { user_status: "PENDING_APPROVAL", onboarding_step: "documents" };
}
