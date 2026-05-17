export type TutorEarningsSummaryDTO = {
  totalHoursWorked: number;
  pendingVerificationHours: number;
  approvedHours: number;
  awaitingExportHours: number;
  expectedEarningsCents: number;
  includedInPayrollCents: number;
};

export type TutorEarningsClaimRowDTO = {
  id: string;
  moduleCode: string;
  moduleName: string;
  sessionDate: string;
  hours: number;
  status: string;
  payrollStageId: string;
  payrollStageLabel: string;
  payrollStageDetail?: string;
  amountCents: number | null;
};

export type TutorPayrollBatchDTO = {
  exportId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  generatedAt: string;
  claimCount: number;
  totalHours: number;
  totalAmountCents: number;
};

export type TutorEarningsIssuesDTO = {
  disputedCount: number;
  rejectedCount: number;
  missingEvidenceCount: number;
};

export type TutorEarningsDTO = {
  summary: TutorEarningsSummaryDTO;
  recentClaims: TutorEarningsClaimRowDTO[];
  payrollBatches: TutorPayrollBatchDTO[];
  issues: TutorEarningsIssuesDTO;
};
