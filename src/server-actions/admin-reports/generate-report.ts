import { differenceInHours, parseISO } from "date-fns";
import { createServerFn } from "@tanstack/react-start";
import type { ReportRowDTO } from "#/lib/report-types";
import { median } from "#/server-actions/lecturer-analytics/helpers";
import { buildIntegrityIssues } from "#/server-actions/lecturer-attendance/build-integrity-issues";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  ADMIN_REPORT_CATALOG,
  APPROVED_CLAIM_STATUSES,
} from "./constants";
import {
  ADMIN_CLAIM_REPORT_SELECT,
  compensationForClaim,
  hoursBetween,
  loadAdminInstitutionContext,
  moduleRateSources,
  parseHours,
  resolveModuleIds,
  type AdminRawClaim,
} from "./helpers";
import { adminReportFiltersSchema } from "./schemas";
import type {
  AdminReportFiltersDTO,
  AdminReportResultDTO,
  AdminReportType,
} from "./types";

function catalogTitle(reportType: AdminReportType): string {
  return ADMIN_REPORT_CATALOG.find((c) => c.id === reportType)?.title ?? reportType;
}

function toFilters(data: {
  dateFrom: string;
  dateTo: string;
  moduleId?: string;
  tutorId?: string;
  lecturerId?: string;
  payrollExportId?: string;
}): AdminReportFiltersDTO {
  return {
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    moduleId: data.moduleId ?? null,
    tutorId: data.tutorId ?? null,
    lecturerId: data.lecturerId ?? null,
    payrollExportId: data.payrollExportId ?? null,
  };
}

async function loadClaimsInRange(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  moduleIds: string[],
  dateFrom: string,
  dateTo: string,
  tutorId?: string,
  statuses?: string[],
): Promise<AdminRawClaim[]> {
  if (!moduleIds.length) return [];

  let query = supabase
    .from("session_claims")
    .select(ADMIN_CLAIM_REPORT_SELECT)
    .in("module_id", moduleIds)
    .gte("session_date", dateFrom)
    .lte("session_date", dateTo)
    .neq("status", "DRAFT");

  if (tutorId) query = query.eq("tutor_id", tutorId);
  if (statuses?.length) query = query.in("status", statuses);

  const { data, error } = await query.order("session_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminRawClaim[];
}

async function loadExportClaimMap(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  claimIds: string[],
): Promise<Map<string, string>> {
  if (!claimIds.length) return new Map();

  const { data, error } = await supabase
    .from("payroll_export_claims")
    .select("claim_id, export:payroll_exports ( period_label )")
    .in("claim_id", claimIds);

  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const exp = unwrapOne(
      row.export as { period_label: string } | { period_label: string }[] | null,
    );
    if (exp?.period_label) {
      map.set(row.claim_id as string, exp.period_label);
    }
  }
  return map;
}

export const generateAdminReportFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminReportFiltersSchema.parse(input))
  .handler(async ({ data }): Promise<AdminReportResultDTO> => {
    const supabase = createSupabaseServerClient();
    const ctx = await loadAdminInstitutionContext(supabase);
    const filters = toFilters(data);

    if (data.dateFrom > data.dateTo) {
      throw new Error("Start date must be on or before end date.");
    }

    const moduleIds = resolveModuleIds(ctx.modules, data.moduleId);
    let lecturerModuleIds = moduleIds;
    if (data.lecturerId) {
      lecturerModuleIds = ctx.modulesWithLecturer
        .filter((m) => m.lecturerId === data.lecturerId)
        .map((m) => m.id);
      if (data.moduleId && !lecturerModuleIds.includes(data.moduleId)) {
        throw new Error("Module is not assigned to the selected lecturer.");
      }
    }

    const generatedAt = new Date().toISOString();
    const body = await buildReport(
      supabase,
      data.reportType,
      {
        ...ctx,
        moduleIds,
        lecturerModuleIds,
        filters,
        tutorId: data.tutorId,
        payrollExportId: data.payrollExportId,
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
      },
    );

    return {
      reportType: data.reportType,
      title: catalogTitle(data.reportType),
      generatedAt,
      filters,
      ...body,
    };
  });

type BuildCtx = Awaited<ReturnType<typeof loadAdminInstitutionContext>> & {
  moduleIds: string[];
  lecturerModuleIds: string[];
  filters: AdminReportFiltersDTO;
  tutorId?: string;
  payrollExportId?: string;
  dateFrom: string;
  dateTo: string;
};

async function buildReport(
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

async function buildPayrollReconciliation(
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

async function buildPayrollBatchDetail(
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

function payrollBatchDetailColumns(
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

async function buildAdminApprovalQueue(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const claims = await loadClaimsInRange(
    supabase,
    ctx.moduleIds,
    ctx.dateFrom,
    ctx.dateTo,
    ctx.tutorId,
    ["VERIFIED"],
  );

  const rows: ReportRowDTO[] = claims.map((c) => {
    const mod = unwrapOne(c.module);
    const tutor = unwrapOne(c.tutor);
    const hours = parseHours(c.hours);
    const pendingHours = hoursBetween(c.submitted_at, null);
    return {
      sessionDate: c.session_date,
      moduleCode: mod?.code ?? "—",
      tutorName: tutor?.full_name ?? "—",
      hours,
      daysPending: pendingHours != null ? Math.round(pendingHours / 24) : null,
      submittedAt: c.submitted_at,
      updatedAt: c.updated_at,
    };
  });

  return {
    columns: [
      { key: "sessionDate", label: "Date" },
      { key: "moduleCode", label: "Module" },
      { key: "tutorName", label: "Tutor" },
      { key: "hours", label: "Hours" },
      { key: "daysPending", label: "Days pending" },
      { key: "submittedAt", label: "Submitted" },
    ],
    rows,
    summary: { awaitingApproval: rows.length },
  };
}

async function buildInstitutionApprovedHours(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const claims = await loadClaimsInRange(
    supabase,
    ctx.moduleIds,
    ctx.dateFrom,
    ctx.dateTo,
    ctx.tutorId,
  );
  const approved = claims.filter((c) =>
    (APPROVED_CLAIM_STATUSES as readonly string[]).includes(c.status),
  );

  const rows: ReportRowDTO[] = approved.map((c) => {
    const mod = unwrapOne(c.module);
    const tutor = unwrapOne(c.tutor);
    return {
      claimId: c.id,
      sessionDate: c.session_date,
      moduleCode: mod?.code ?? "—",
      tutorName: tutor?.full_name ?? "—",
      hours: parseHours(c.hours),
      status: c.status,
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
      { key: "submittedAt", label: "Submitted" },
    ],
    rows,
    summary: {
      claimCount: rows.length,
      totalHours: Math.round(totalHours * 100) / 100,
    },
  };
}

async function buildPipelineSnapshot(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const claims = await loadClaimsInRange(
    supabase,
    ctx.moduleIds,
    ctx.dateFrom,
    ctx.dateTo,
    ctx.tutorId,
  );

  const agg = new Map<string, { count: number; hours: number }>();
  for (const c of claims) {
    const row = agg.get(c.status) ?? { count: 0, hours: 0 };
    row.count += 1;
    row.hours += parseHours(c.hours);
    agg.set(c.status, row);
  }

  const rows: ReportRowDTO[] = [...agg.entries()]
    .map(([status, v]) => ({
      status,
      claimCount: v.count,
      totalHours: Math.round(v.hours * 100) / 100,
    }))
    .sort((a, b) => String(a.status).localeCompare(String(b.status)));

  return {
    columns: [
      { key: "status", label: "Status" },
      { key: "claimCount", label: "Claims" },
      { key: "totalHours", label: "Hours" },
    ],
    rows,
    summary: { statusBuckets: rows.length },
  };
}

async function buildDisputesRegister(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const claims = await loadClaimsInRange(
    supabase,
    ctx.moduleIds,
    ctx.dateFrom,
    ctx.dateTo,
    ctx.tutorId,
  );

  const disputed = claims.filter((c) => c.status === "DISPUTED");
  const rejected = claims.filter((c) => c.status === "REJECTED");
  const disputeIds = disputed.map((c) => c.id);

  const disputeByClaim = new Map<string, Record<string, unknown>>();
  if (disputeIds.length) {
    const { data: disputeRows, error } = await supabase
      .from("disputes")
      .select("claim_id, reason, status, raised_at, resolved_at")
      .in("claim_id", disputeIds);
    if (error) throw new Error(error.message);
    for (const d of disputeRows ?? []) {
      disputeByClaim.set(d.claim_id as string, d);
    }
  }

  const rows: ReportRowDTO[] = [];

  for (const c of disputed) {
    const mod = unwrapOne(c.module);
    const tutor = unwrapOne(c.tutor);
    const d = disputeByClaim.get(c.id);
    rows.push({
      recordType: "Dispute",
      sessionDate: c.session_date,
      moduleCode: mod?.code ?? "—",
      tutorName: tutor?.full_name ?? "—",
      hours: parseHours(c.hours),
      reason: (d?.reason as string) ?? "—",
      detailStatus: (d?.status as string) ?? "—",
      raisedAt: (d?.raised_at as string) ?? null,
    });
  }

  for (const c of rejected) {
    const mod = unwrapOne(c.module);
    const tutor = unwrapOne(c.tutor);
    rows.push({
      recordType: "Rejection",
      sessionDate: c.session_date,
      moduleCode: mod?.code ?? "—",
      tutorName: tutor?.full_name ?? "—",
      hours: parseHours(c.hours),
      reason: "Rejected by lecturer",
      detailStatus: c.status,
      raisedAt: c.updated_at,
    });
  }

  rows.sort((a, b) =>
    String(a.sessionDate).localeCompare(String(b.sessionDate)),
  );

  return {
    columns: [
      { key: "recordType", label: "Type" },
      { key: "sessionDate", label: "Date" },
      { key: "moduleCode", label: "Module" },
      { key: "tutorName", label: "Tutor" },
      { key: "hours", label: "Hours" },
      { key: "reason", label: "Reason" },
      { key: "detailStatus", label: "Status" },
      { key: "raisedAt", label: "When" },
    ],
    rows,
    summary: {
      disputes: disputed.length,
      rejections: rejected.length,
    },
  };
}

async function buildVerificationSla(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const lecturerIds = new Set(
    ctx.modulesWithLecturer
      .filter((m) => ctx.lecturerModuleIds.includes(m.id) && m.lecturerId)
      .map((m) => m.lecturerId as string),
  );

  if (!lecturerIds.size) {
    return {
      columns: [
        { key: "lecturerName", label: "Lecturer" },
        { key: "modules", label: "Modules" },
        { key: "pendingCount", label: "Pending verify" },
        { key: "medianVerifyHours", label: "Median verify (h)" },
        { key: "actionsInPeriod", label: "Actions" },
      ],
      rows: [],
      summary: { lecturerCount: 0 },
    };
  }

  const { data: lecturers, error: lecErr } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", [...lecturerIds]);

  if (lecErr) throw new Error(lecErr.message);

  const pendingClaims = await loadClaimsInRange(
    supabase,
    ctx.lecturerModuleIds,
    ctx.dateFrom,
    ctx.dateTo,
    ctx.tutorId,
    ["PENDING_VERIFICATION"],
  );

  const pendingByLecturer = new Map<string, number>();
  for (const c of pendingClaims) {
    const mod = ctx.modulesWithLecturer.find((m) => m.id === c.module_id);
    if (!mod?.lecturerId) continue;
    pendingByLecturer.set(
      mod.lecturerId,
      (pendingByLecturer.get(mod.lecturerId) ?? 0) + 1,
    );
  }

  const claimIdsInRange = (
    await loadClaimsInRange(
      supabase,
      ctx.lecturerModuleIds,
      ctx.dateFrom,
      ctx.dateTo,
      ctx.tutorId,
    )
  ).map((c) => c.id);

  const verifyHoursByLecturer = new Map<string, number[]>();
  const actionCountByLecturer = new Map<string, number>();

  if (claimIdsInRange.length) {
    const { data: actions, error: actErr } = await supabase
      .from("verification_actions")
      .select("claim_id, actor_id, action_type, created_at")
      .in("claim_id", claimIdsInRange)
      .gte("created_at", `${ctx.dateFrom}T00:00:00`)
      .lte("created_at", `${ctx.dateTo}T23:59:59`);

    if (actErr) throw new Error(actErr.message);

    const claimSubmitted = new Map(
      (
        await loadClaimsInRange(
          supabase,
          ctx.lecturerModuleIds,
          ctx.dateFrom,
          ctx.dateTo,
        )
      ).map((c) => [c.id, c.submitted_at]),
    );

    for (const action of actions ?? []) {
      const actorId = action.actor_id as string;
      if (!lecturerIds.has(actorId)) continue;
      actionCountByLecturer.set(
        actorId,
        (actionCountByLecturer.get(actorId) ?? 0) + 1,
      );

      if (
        action.action_type === "APPROVED" ||
        action.action_type === "SIGNED_APPROVAL"
      ) {
        const submitted = claimSubmitted.get(action.claim_id as string);
        if (submitted) {
          const hours = differenceInHours(
            parseISO(action.created_at as string),
            parseISO(submitted),
          );
          if (hours >= 0) {
            const list = verifyHoursByLecturer.get(actorId) ?? [];
            list.push(hours);
            verifyHoursByLecturer.set(actorId, list);
          }
        }
      }
    }
  }

  const moduleCountByLecturer = new Map<string, number>();
  for (const m of ctx.modulesWithLecturer) {
    if (!m.lecturerId || !ctx.lecturerModuleIds.includes(m.id)) continue;
    moduleCountByLecturer.set(
      m.lecturerId,
      (moduleCountByLecturer.get(m.lecturerId) ?? 0) + 1,
    );
  }

  const rows: ReportRowDTO[] = (lecturers ?? []).map((lec) => {
    const id = lec.id as string;
    const verifyList = verifyHoursByLecturer.get(id) ?? [];
    return {
      lecturerName: lec.full_name as string,
      lecturerEmail: lec.email as string,
      modules: moduleCountByLecturer.get(id) ?? 0,
      pendingCount: pendingByLecturer.get(id) ?? 0,
      medianVerifyHours: median(verifyList),
      actionsInPeriod: actionCountByLecturer.get(id) ?? 0,
    };
  });

  rows.sort((a, b) =>
    String(a.lecturerName).localeCompare(String(b.lecturerName)),
  );

  return {
    columns: [
      { key: "lecturerName", label: "Lecturer" },
      { key: "modules", label: "Modules" },
      { key: "pendingCount", label: "Pending verify" },
      { key: "medianVerifyHours", label: "Median verify (h)" },
      { key: "actionsInPeriod", label: "Actions" },
    ],
    rows,
    summary: { lecturerCount: rows.length },
  };
}

async function buildOnboardingStatus(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const { data: users, error } = await supabase
    .from("users")
    .select(
      "full_name, email, role, approval_status, user_status, onboarding_step, is_active, last_login_at, created_at",
    )
    .eq("institution_id", ctx.institutionId)
    .in("role", ["TUTOR", "LECTURER", "ADMIN"])
    .order("role")
    .order("full_name");

  if (error) throw new Error(error.message);

  const rows: ReportRowDTO[] = (users ?? []).map((u) => ({
    fullName: u.full_name as string,
    email: u.email as string,
    role: u.role as string,
    approvalStatus: u.approval_status as string,
    userStatus: (u.user_status as string | null) ?? "—",
    onboardingStep: (u.onboarding_step as string | null) ?? "—",
    isActive: u.is_active ? "Yes" : "No",
    lastLoginAt: (u.last_login_at as string | null) ?? "—",
    createdAt: u.created_at as string,
  }));

  return {
    columns: [
      { key: "fullName", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "approvalStatus", label: "Approval" },
      { key: "userStatus", label: "User status" },
      { key: "onboardingStep", label: "Onboarding step" },
      { key: "isActive", label: "Active" },
      { key: "lastLoginAt", label: "Last login" },
    ],
    rows,
    summary: { staffCount: rows.length },
  };
}

async function buildAuditLogExport(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select(
      "id, created_at, event, entity_type, entity_id, actor_id, ip_address, payload",
    )
    .eq("institution_id", ctx.institutionId)
    .gte("created_at", `${ctx.dateFrom}T00:00:00`)
    .lte("created_at", `${ctx.dateTo}T23:59:59`)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);

  const actorIds = [
    ...new Set((logs ?? []).map((l) => l.actor_id as string).filter(Boolean)),
  ];
  const actorNames = new Map<string, string>();
  if (actorIds.length) {
    const { data: actors } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", actorIds);
    for (const a of actors ?? []) {
      actorNames.set(a.id as string, a.full_name as string);
    }
  }

  const rows: ReportRowDTO[] = (logs ?? []).map((l) => ({
    occurredAt: l.created_at as string,
    event: l.event as string,
    entityType: l.entity_type as string,
    entityId: l.entity_id as string,
    actorName: l.actor_id ? (actorNames.get(l.actor_id as string) ?? l.actor_id) : "—",
    ipAddress: (l.ip_address as string | null) ?? "—",
    payloadSummary:
      l.payload && typeof l.payload === "object"
        ? JSON.stringify(l.payload).slice(0, 120)
        : "—",
  }));

  return {
    columns: [
      { key: "occurredAt", label: "When" },
      { key: "event", label: "Event" },
      { key: "entityType", label: "Entity" },
      { key: "actorName", label: "Actor" },
      { key: "ipAddress", label: "IP" },
      { key: "payloadSummary", label: "Payload" },
    ],
    rows,
    summary: {
      eventCount: rows.length,
      note: rows.length >= 5000 ? "Capped at 5000 events" : null,
    },
  };
}

async function buildScheduleUtilization(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  if (!ctx.moduleIds.length) {
    return scheduleUtilizationColumns([]);
  }

  const { data: sessions, error } = await supabase
    .from("scheduled_sessions")
    .select(
      `
      id,
      session_date,
      status,
      module:modules ( code )
    `,
    )
    .in("module_id", ctx.moduleIds)
    .gte("session_date", ctx.dateFrom)
    .lte("session_date", ctx.dateTo);

  if (error) throw new Error(error.message);

  const agg = new Map<
    string,
    { code: string; scheduled: number; cancelled: number; rescheduled: number }
  >();

  for (const row of sessions ?? []) {
    const mod = unwrapOne(
      row.module as { code: string } | { code: string }[] | null,
    );
    const code = mod?.code ?? "—";
    const entry = agg.get(code) ?? {
      code,
      scheduled: 0,
      cancelled: 0,
      rescheduled: 0,
    };
    const status = row.status as string;
    if (status === "SCHEDULED") entry.scheduled += 1;
    else if (status === "CANCELLED") entry.cancelled += 1;
    else if (status === "RESCHEDULED") entry.rescheduled += 1;
    agg.set(code, entry);
  }

  const rows: ReportRowDTO[] = [...agg.values()]
    .map((r) => ({
      moduleCode: r.code,
      scheduled: r.scheduled,
      cancelled: r.cancelled,
      rescheduled: r.rescheduled,
      total: r.scheduled + r.cancelled + r.rescheduled,
    }))
    .sort((a, b) => String(a.moduleCode).localeCompare(String(b.moduleCode)));

  return scheduleUtilizationColumns(rows);
}

function scheduleUtilizationColumns(rows: ReportRowDTO[]) {
  return {
    columns: [
      { key: "moduleCode", label: "Module" },
      { key: "scheduled", label: "Scheduled" },
      { key: "cancelled", label: "Cancelled" },
      { key: "rescheduled", label: "Rescheduled" },
      { key: "total", label: "Total" },
    ],
    rows,
    summary: { moduleCount: rows.length },
  };
}

async function buildAttendanceIntegrity(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  const claims = await loadClaimsInRange(
    supabase,
    ctx.moduleIds,
    ctx.dateFrom,
    ctx.dateTo,
    ctx.tutorId,
  );

  const claimIds = claims.map((c) => c.id);
  const evidenceClaimIds = new Set<string>();
  const scanCountByClaim = new Map<string, number>();
  const unverifiedByClaim = new Map<string, number>();

  if (claimIds.length) {
    const { data: evidence } = await supabase
      .from("attendance_evidence")
      .select("claim_id")
      .in("claim_id", claimIds);
    for (const e of evidence ?? []) {
      evidenceClaimIds.add(e.claim_id as string);
    }

    const { data: attendance } = await supabase
      .from("session_attendance")
      .select("session_id, status")
      .in("session_id", claimIds);

    for (const row of attendance ?? []) {
      const cid = row.session_id as string;
      scanCountByClaim.set(cid, (scanCountByClaim.get(cid) ?? 0) + 1);
      if (row.status === "PENDING") {
        unverifiedByClaim.set(cid, (unverifiedByClaim.get(cid) ?? 0) + 1);
      }
    }
  }

  const integrityClaims = claims.map((c) => ({
    id: c.id,
    session_date: c.session_date,
    status: c.status as "PENDING_VERIFICATION" | "VERIFIED" | "APPROVED",
    attendance_present_count: c.attendance_present_count,
    moduleCode: unwrapOne(c.module)?.code ?? "—",
  }));

  const issues = buildIntegrityIssues(
    integrityClaims,
    scanCountByClaim,
    evidenceClaimIds,
    unverifiedByClaim,
  );

  const rows: ReportRowDTO[] = issues.map((i) => ({
    issueKind: i.kind,
    sessionDate: i.session_date,
    moduleCode: i.moduleCode,
    claimId: i.claimId,
    message: i.message,
  }));

  return {
    columns: [
      { key: "issueKind", label: "Issue" },
      { key: "sessionDate", label: "Date" },
      { key: "moduleCode", label: "Module" },
      { key: "claimId", label: "Claim ID" },
      { key: "message", label: "Details" },
    ],
    rows,
    summary: { issueCount: rows.length },
  };
}
