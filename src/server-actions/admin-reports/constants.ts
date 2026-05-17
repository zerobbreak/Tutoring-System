import type { AdminReportCatalogItemDTO, AdminReportCategory } from "./types";

/** VERIFIED and APPROVED both count as approved hours in reports. */
export const APPROVED_CLAIM_STATUSES = ["VERIFIED", "APPROVED"] as const;

export const DEFAULT_REPORT_LOOKBACK_DAYS = 90;

export const ADMIN_REPORT_CATEGORY_LABELS: Record<AdminReportCategory, string> = {
  payroll: "Payroll & finance",
  claims: "Claims workflow",
  people: "People",
  compliance: "Compliance",
  operations: "Operations",
};

export const ADMIN_REPORT_CATALOG: AdminReportCatalogItemDTO[] = [
  {
    id: "payroll_reconciliation",
    category: "payroll",
    title: "Payroll reconciliation",
    description:
      "Approved and verified claims with hours, rates, amounts, and payroll batch linkage.",
    requiresPayrollExport: false,
  },
  {
    id: "payroll_batch_detail",
    category: "payroll",
    title: "Payroll batch detail",
    description: "Line items for a previously generated payroll export batch.",
    requiresPayrollExport: true,
  },
  {
    id: "admin_approval_queue",
    category: "claims",
    title: "Admin approval queue",
    description: "Verified claims awaiting admin sign-off for payroll.",
    requiresPayrollExport: false,
  },
  {
    id: "institution_approved_hours",
    category: "claims",
    title: "Institution approved hours",
    description: "All verified and approved session hours across the institution.",
    requiresPayrollExport: false,
  },
  {
    id: "claims_pipeline_snapshot",
    category: "claims",
    title: "Claims pipeline snapshot",
    description: "Counts and hours grouped by claim status for the selected period.",
    requiresPayrollExport: false,
  },
  {
    id: "disputes_register",
    category: "claims",
    title: "Disputes & rejections",
    description: "Disputed claims and lecturer rejections with reasons.",
    requiresPayrollExport: false,
  },
  {
    id: "verification_sla_lecturer",
    category: "people",
    title: "Verification SLA by lecturer",
    description:
      "Pending verification workload and median verify time per module lecturer.",
    requiresPayrollExport: false,
  },
  {
    id: "onboarding_status",
    category: "people",
    title: "Onboarding status",
    description: "Staff accounts by role, approval status, and platform access.",
    requiresPayrollExport: false,
  },
  {
    id: "audit_log_export",
    category: "compliance",
    title: "Audit log export",
    description: "Institution audit trail events for the selected date range.",
    requiresPayrollExport: false,
  },
  {
    id: "schedule_utilization",
    category: "operations",
    title: "Schedule utilization",
    description: "Scheduled sessions by module and status (scheduled, cancelled, rescheduled).",
    requiresPayrollExport: false,
  },
  {
    id: "attendance_integrity",
    category: "operations",
    title: "Attendance integrity",
    description:
      "Sessions with missing registers, headcount mismatches, or unverified QR scans.",
    requiresPayrollExport: false,
  },
];
