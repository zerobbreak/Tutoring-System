import type { ReportCatalogItemDTO, ReportCategory } from "./types";

/** VERIFIED and APPROVED both count as approved hours in reports. */
export const APPROVED_CLAIM_STATUSES = ["VERIFIED", "APPROVED"] as const;

export const DEFAULT_REPORT_LOOKBACK_DAYS = 90;

export const REPORT_CATALOG: ReportCatalogItemDTO[] = [
  {
    id: "attendance_module",
    category: "attendance",
    title: "Module attendance",
    description: "Session attendance rates aggregated by module.",
  },
  {
    id: "attendance_tutor",
    category: "attendance",
    title: "Tutor attendance performance",
    description: "Per-tutor attendance averages across your modules.",
  },
  {
    id: "attendance_student_participation",
    category: "attendance",
    title: "Student participation",
    description: "Check-in counts and status breakdown per student (sessions attended).",
  },
  {
    id: "claims_approved_hours",
    category: "claims",
    title: "Approved hours",
    description: "Verified and signed-off session hours for payroll review.",
  },
  {
    id: "claims_disputed",
    category: "claims",
    title: "Disputed claims",
    description: "Claims in dispute with reasons and resolution status.",
  },
  {
    id: "claims_pending",
    category: "claims",
    title: "Pending submissions",
    description: "Claims awaiting verification.",
  },
  {
    id: "tutor_workload",
    category: "tutor",
    title: "Workload summaries",
    description: "Hours claimed, scheduled sessions, and assignments per tutor.",
  },
  {
    id: "tutor_performance",
    category: "tutor",
    title: "Performance reviews",
    description:
      "Derived metrics snapshot (approval rate, attendance, disputes) — not stored formal reviews.",
  },
  {
    id: "tutor_attendance_impact",
    category: "tutor",
    title: "Attendance impact",
    description: "Correlation of tutor attendance rates with claim outcomes.",
  },
];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  attendance: "Attendance",
  claims: "Claims",
  tutor: "Tutor",
};
