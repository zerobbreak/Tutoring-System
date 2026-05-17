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
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function mapOnboardingCounts(
  rows: { approval_status: string; role: string }[],
  role: "TUTOR" | "LECTURER",
): { status: string; label: string; count: number }[] {
  const order = [
    "pending_documents",
    "pending_review",
    "approved",
    "rejected",
  ];
  const counts = new Map<string, number>();
  for (const status of order) {
    counts.set(status, 0);
  }
  for (const row of rows) {
    if (row.role !== role) continue;
    const s = row.approval_status;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return order.map((status) => ({
    status,
    label: ONBOARDING_LABELS[status] ?? status,
    count: counts.get(status) ?? 0,
  }));
}
