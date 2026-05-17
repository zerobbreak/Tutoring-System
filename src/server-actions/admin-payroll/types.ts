export type PayrollExportRowDTO = {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  claim_count: number;
  total_hours: number;
  status: string;
  generated_at: string;
  file_url: string | null;
};

export type PayrollSummaryDTO = {
  approvedHoursAwaitingExport: number;
  approvedClaimsAwaitingExport: number;
  exportsThisMonth: number;
  totalExportedHoursThisMonth: number;
};
