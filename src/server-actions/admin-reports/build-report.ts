import type { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  buildAdminApprovalQueue,
  buildDisputesRegister,
  buildInstitutionApprovedHours,
  buildPipelineSnapshot,
} from "./build-claims-reports";
import { buildAuditLogExport } from "./build-compliance-reports";
import {
  buildAttendanceIntegrity,
  buildScheduleUtilization,
} from "./build-operations-reports";
import {
  buildOnboardingStatus,
  buildVerificationSla,
} from "./build-people-reports";
import {
  buildPayrollBatchDetail,
  buildPayrollReconciliation,
} from "./build-payroll-reports";
import type { BuildCtx } from "./report-build-context";
import type { AdminReportResultDTO, AdminReportType } from "./types";

export async function buildReport(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  reportType: AdminReportType,
  ctx: BuildCtx,
): Promise<Pick<AdminReportResultDTO, "columns" | "rows" | "summary">> {
  switch (reportType) {
    case "payroll_reconciliation":
      return buildPayrollReconciliation(supabase, ctx);
    case "payroll_batch_detail":
      return buildPayrollBatchDetail(supabase, ctx);
    case "admin_approval_queue":
      return buildAdminApprovalQueue(supabase, ctx);
    case "institution_approved_hours":
      return buildInstitutionApprovedHours(supabase, ctx);
    case "claims_pipeline_snapshot":
      return buildPipelineSnapshot(supabase, ctx);
    case "disputes_register":
      return buildDisputesRegister(supabase, ctx);
    case "verification_sla_lecturer":
      return buildVerificationSla(supabase, ctx);
    case "onboarding_status":
      return buildOnboardingStatus(supabase, ctx);
    case "audit_log_export":
      return buildAuditLogExport(supabase, ctx);
    case "schedule_utilization":
      return buildScheduleUtilization(supabase, ctx);
    case "attendance_integrity":
      return buildAttendanceIntegrity(supabase, ctx);
    default:
      return { columns: [], rows: [], summary: null };
  }
}
