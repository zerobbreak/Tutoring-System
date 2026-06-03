import type {
  VerificationClaimCardDTO,
  VerificationClaimDetailDTO,
  VerificationModuleOptionDTO,
} from "#/server-actions/lecturer-verification/types";

export type AdminApprovalClaimCardDTO = VerificationClaimCardDTO & {
  frozen_at: string | null;
  lecturer_verified: boolean;
};

export type AdminApprovalTimelineStageDTO = {
  id: string;
  stage:
    | "TUTOR_SUBMITTED"
    | "LECTURER_VERIFIED"
    | "ADMIN_APPROVED"
    | "PAYROLL_EXPORTED"
    | "ACTION";
  label: string;
  at: string;
  detail?: string;
};

export type AdminApprovalClaimDetailDTO = VerificationClaimDetailDTO & {
  frozen_at: string | null;
  lecturer_verified: boolean;
  payroll_exported_at: string | null;
  payroll_period_label: string | null;
  workflow_stages: AdminApprovalTimelineStageDTO[];
};

export type AdminApprovalsQueueDTO = {
  awaitingAdmin: AdminApprovalClaimCardDTO[];
  disputed: AdminApprovalClaimCardDTO[];
  recentlyApproved: AdminApprovalClaimCardDTO[];
  escalated: AdminApprovalClaimCardDTO[];
  modules: VerificationModuleOptionDTO[];
};

export type AdminApprovalActionKind =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_CLARIFICATION"
  | "ESCALATE"
  | "FREEZE";

export type PayrollExportResultDTO = {
  exportId: string;
  periodLabel: string;
  claimCount: number;
  totalHours: number;
  csvContent: string;
  fileName: string;
};

export type { VerificationModuleOptionDTO };
