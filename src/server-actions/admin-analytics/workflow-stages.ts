import {
  median,
  turnaroundHours,
  type VerificationActionRow,
} from "#/server-actions/lecturer-analytics/helpers";
import type { WorkflowStageTimingDTO } from "./types";

function firstActionByClaim(
  actions: VerificationActionRow[],
  predicate: (a: VerificationActionRow) => boolean,
): Map<string, string> {
  const map = new Map<string, string>();
  const sorted = [...actions].sort((a, b) =>
    a.acted_at.localeCompare(b.acted_at),
  );
  for (const action of sorted) {
    if (!predicate(action)) continue;
    if (!map.has(action.claim_id)) {
      map.set(action.claim_id, action.acted_at);
    }
  }
  return map;
}

export function firstVerifiedByClaim(
  actions: VerificationActionRow[],
): Map<string, string> {
  return firstActionByClaim(
    actions,
    (a) =>
      a.action_type === "APPROVED" && a.to_status === "VERIFIED",
  );
}

export function firstAdminApprovedByClaim(
  actions: VerificationActionRow[],
): Map<string, string> {
  return firstActionByClaim(
    actions,
    (a) => a.action_type === "ADMIN_APPROVED",
  );
}

export function buildWorkflowStageTimings(
  submittedByClaim: Map<string, string>,
  verifiedAt: Map<string, string>,
  approvedAt: Map<string, string>,
): WorkflowStageTimingDTO[] {
  const submitToVerify: number[] = [];
  const verifyToApprove: number[] = [];
  const submitToApprove: number[] = [];

  for (const [claimId, submitted] of submittedByClaim) {
    const verified = verifiedAt.get(claimId);
    const approved = approvedAt.get(claimId);

    if (verified) {
      submitToVerify.push(turnaroundHours(submitted, verified));
    }
    if (verified && approved) {
      verifyToApprove.push(turnaroundHours(verified, approved));
    }
    if (approved) {
      submitToApprove.push(turnaroundHours(submitted, approved));
    }
  }

  return [
    {
      stage: "SUBMIT_TO_VERIFY",
      label: "Submit → lecturer verify",
      medianHours: median(submitToVerify),
    },
    {
      stage: "VERIFY_TO_APPROVE",
      label: "Verify → admin approve",
      medianHours: median(verifyToApprove),
    },
    {
      stage: "SUBMIT_TO_APPROVE",
      label: "Submit → final approval",
      medianHours: median(submitToApprove),
    },
  ];
}

export function buildSubmittedByClaim(
  claims: { id: string; submitted_at: string | null }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of claims) {
    if (c.submitted_at) {
      map.set(c.id, c.submitted_at);
    }
  }
  return map;
}

const ONBOARDING_LABELS: Record<string, string> = {
  pending_documents: "Pending documents",
  pending_review: "Pending approval",
  active: "Active",
  suspended: "Suspended",
  rejected: "Rejected",
};

function onboardingBucket(row: {
  user_status: string;
  onboarding_step: string | null;
}): string {
  if (row.user_status === "ACTIVE") return "active";
  if (row.user_status === "SUSPENDED") return "suspended";
  if (row.user_status === "REJECTED") return "rejected";
  if (row.onboarding_step === "ready_for_review") return "pending_review";
  return "pending_documents";
}

export function mapOnboardingCounts(
  rows: {
    user_status: string;
    onboarding_step: string | null;
    role: string;
  }[],
  role: "TUTOR" | "LECTURER",
): { status: string; label: string; count: number }[] {
  const order = [
    "pending_documents",
    "pending_review",
    "active",
    "suspended",
    "rejected",
  ];
  const counts = new Map<string, number>();
  for (const status of order) {
    counts.set(status, 0);
  }
  for (const row of rows) {
    if (row.role !== role) continue;
    const bucket = onboardingBucket(row);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return order.map((status) => ({
    status,
    label: ONBOARDING_LABELS[status] ?? status,
    count: counts.get(status) ?? 0,
  }));
}
