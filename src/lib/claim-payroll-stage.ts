import type { ClaimStatus } from "#/lib/session-claim-display";

export type ClaimPayrollStageId =
  | "draft"
  | "pending_verification"
  | "verified"
  | "rejected"
  | "disputed"
  | "approved_ready"
  | "included_in_export"
  | "paid";

export type ClaimPayrollStage = {
  id: ClaimPayrollStageId;
  label: string;
  detail?: string;
};

export function deriveClaimPayrollStage(input: {
  status: ClaimStatus;
  exportedPeriodLabel?: string | null;
  exportStatus?: string | null;
  paidAt?: string | null;
}): ClaimPayrollStage {
  if (input.paidAt) {
    return { id: "paid", label: "Recorded payout" };
  }

  if (input.exportedPeriodLabel) {
    const detail =
      input.exportStatus && input.exportStatus !== "GENERATED"
        ? `${input.exportedPeriodLabel} · ${input.exportStatus.toLowerCase()}`
        : input.exportedPeriodLabel;
    return {
      id: "included_in_export",
      label: "Included in export",
      detail,
    };
  }

  switch (input.status) {
    case "DRAFT":
      return { id: "draft", label: "Draft" };
    case "PENDING_VERIFICATION":
      return { id: "pending_verification", label: "Pending verification" };
    case "VERIFIED":
      return { id: "verified", label: "Verified" };
    case "APPROVED":
      return { id: "approved_ready", label: "Payroll ready" };
    case "REJECTED":
      return { id: "rejected", label: "Rejected" };
    case "DISPUTED":
      return { id: "disputed", label: "Disputed" };
    default:
      return { id: "draft", label: input.status };
  }
}

export function payrollStageBadgeClass(id: ClaimPayrollStageId): string {
  switch (id) {
    case "paid":
    case "included_in_export":
    case "approved_ready":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
    case "pending_verification":
    case "verified":
      return "border-amber-500/30 bg-amber-500/10 text-amber-900";
    case "rejected":
    case "disputed":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted/50 text-muted-foreground";
  }
}
