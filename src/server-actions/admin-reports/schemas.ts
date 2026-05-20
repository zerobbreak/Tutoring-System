import { z } from "zod";

export const adminReportTypeSchema = z.enum([
  "payroll_reconciliation",
  "payroll_batch_detail",
  "admin_approval_queue",
  "institution_approved_hours",
  "claims_pipeline_snapshot",
  "disputes_register",
  "verification_sla_lecturer",
  "onboarding_status",
  "audit_log_export",
  "schedule_utilization",
  "attendance_integrity",
]);

export const adminReportFiltersSchema = z.object({
  reportType: adminReportTypeSchema,
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moduleId: z.string().uuid().optional(),
  tutorId: z.string().uuid().optional(),
  lecturerId: z.string().uuid().optional(),
  payrollExportId: z.string().uuid().optional(),
});
