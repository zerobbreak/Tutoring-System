import type { ReportRowDTO } from "#/lib/report-types";
import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import {
  ADMIN_CLAIM_REPORT_SELECT,
  compensationForClaim,
  moduleRateSources,
  parseHours,
  type AdminRawClaim,
} from "./helpers";
import { loadClaimsInRange, loadExportClaimMap } from "./load-report-claims";
import type { BuildCtx } from "./report-build-context";
import type { AdminReportResultDTO } from "./types";

export async function buildPayrollReconciliation(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const claims = await loadClaimsInRange(
    supabase,
    ctx.moduleIds,
    ctx.dateFrom,
    ctx.dateTo,
    ctx.tutorId,
    ["VERIFIED", "APPROVED"],
  );
  const exportMap = await loadExportClaimMap(
    supabase,
    claims.map((c) => c.id),
  );

  const rows: ReportRowDTO[] = claims.map((c) => {
    const mod = unwrapOne(c.module);
    const tutor = unwrapOne(c.tutor);
    const hours = parseHours(c.hours);
    const frozen = unwrapOne(c.claim_compensation ?? null);
    const comp = compensationForClaim(
      hours,
      moduleRateSources(c, ctx.institutionDefaultRateCents),
      frozen,
    );
    return {
      sessionDate: c.session_date,
      moduleCode: mod?.code ?? "—",
      tutorName: tutor?.full_name ?? "—",
      hours,
      status: c.status,
      hourlyRate: comp.hourlyRateLabel,
      amount: comp.amountLabel,
      payrollBatch: exportMap.get(c.id) ?? (c.status === "APPROVED" ? "Not exported" : "—"),
      submittedAt: c.submitted_at,
    };
  });

  const totalHours = rows.reduce(
    (s, r) => s + (typeof r.hours === "number" ? r.hours : 0),
    0,
  );

  return {
    columns: [
      { key: "sessionDate", label: "Date" },
      { key: "moduleCode", label: "Module" },
      { key: "tutorName", label: "Tutor" },
      { key: "hours", label: "Hours" },
      { key: "status", label: "Status" },
      { key: "hourlyRate", label: "Rate" },
      { key: "amount", label: "Amount" },
      { key: "payrollBatch", label: "Payroll batch" },
      { key: "submittedAt", label: "Submitted" },
    ],
    rows,
    summary: {
      claimCount: rows.length,
      totalHours: Math.round(totalHours * 100) / 100,
    },
  };
}

export async function buildPayrollBatchDetail(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  if (!ctx.payrollExportId) {
    throw new Error("Select a payroll batch to export.");
  }

  const { data: batch, error: batchErr } = await supabase
    .from("payroll_exports")
    .select("id, period_label, period_start, period_end, institution_id")
    .eq("id", ctx.payrollExportId)
    .eq("institution_id", ctx.institutionId)
    .single();

  if (batchErr || !batch) {
    throw new Error("Payroll batch not found.");
  }

  const { data: links, error: linkErr } = await supabase
    .from("payroll_export_claims")
    .select("claim_id")
    .eq("export_id", ctx.payrollExportId);

  if (linkErr) throw new Error(linkErr.message);

  const batchSummary: ReportRowDTO = {
    periodLabel: batch.period_label as string,
    periodStart: batch.period_start as string,
    periodEnd: batch.period_end as string,
    claimCount: 0,
    totalHours: 0,
  };

  const claimIds = (links ?? []).map((l) => l.claim_id as string);
  if (!claimIds.length) {
    return payrollBatchDetailColumns([], batchSummary);
  }

  const { data: claimRows, error: claimErr } = await supabase
    .from("session_claims")
    .select(ADMIN_CLAIM_REPORT_SELECT)
    .in("id", claimIds)
    .order("session_date", { ascending: true });

  if (claimErr) throw new Error(claimErr.message);

  const claims = (claimRows ?? []) as unknown as AdminRawClaim[];
  const rows: ReportRowDTO[] = claims.map((c) => {
    const mod = unwrapOne(c.module);
    const tutor = unwrapOne(c.tutor);
    const hours = parseHours(c.hours);
    const frozen = unwrapOne(c.claim_compensation ?? null);
    const comp = compensationForClaim(
      hours,
      moduleRateSources(c, ctx.institutionDefaultRateCents),
      frozen,
    );
    return {
      sessionDate: c.session_date,
      moduleCode: mod?.code ?? "—",
      tutorName: tutor?.full_name ?? "—",
      hours,
      status: c.status,
      hourlyRate: comp.hourlyRateLabel,
      amount: comp.amountLabel,
    };
  });

  const totalHours = rows.reduce(
    (s, r) => s + (typeof r.hours === "number" ? r.hours : 0),
    0,
  );

  batchSummary.claimCount = rows.length;
  batchSummary.totalHours = Math.round(totalHours * 100) / 100;
  return payrollBatchDetailColumns(rows, batchSummary);
}

export function payrollBatchDetailColumns(
  rows: ReportRowDTO[],
  summary: ReportRowDTO,
): Pick<AdminReportResultDTO, "columns" | "rows" | "summary"> {
  return {
    columns: [
      { key: "sessionDate", label: "Date" },
      { key: "moduleCode", label: "Module" },
      { key: "tutorName", label: "Tutor" },
      { key: "hours", label: "Hours" },
      { key: "status", label: "Status" },
      { key: "hourlyRate", label: "Rate" },
      { key: "amount", label: "Amount" },
    ],
    rows,
    summary,
  };
}
