import { createServerFn } from "@tanstack/react-start";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import {
  computeTutorStats,
  type ClaimStatsRow,
} from "#/server-actions/lecturer-tutors/compute-tutor-stats";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import { APPROVED_CLAIM_STATUSES, REPORT_CATALOG } from "./constants";
import { loadLecturerContext, parseHours, pct, resolveModuleIds } from "./helpers";
import { reportFiltersSchema } from "./schemas";
import type {
  ReportFiltersDTO,
  ReportResultDTO,
  ReportRowDTO,
  ReportType,
} from "./types";

const CLAIM_REPORT_SELECT = `
  id,
  tutor_id,
  module_id,
  session_date,
  start_time,
  end_time,
  hours,
  status,
  submitted_at,
  updated_at,
  attendance_present_count,
  attendance_expected_count,
  source_scheduled_session_id,
  module:modules ( code, name ),
  tutor:users!session_claims_tutor_id_fkey ( id, full_name, email )
`;

type RawClaim = {
  id: string;
  tutor_id: string;
  module_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number | string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  source_scheduled_session_id: string | null;
  module:
    | { code: string; name: string }
    | { code: string; name: string }[]
    | null;
  tutor:
    | { id: string; full_name: string; email: string }
    | { id: string; full_name: string; email: string }[]
    | null;
};

function catalogTitle(reportType: ReportType): string {
  return REPORT_CATALOG.find((c) => c.id === reportType)?.title ?? reportType;
}

function attendanceRate(
  present: number | null,
  expected: number | null,
): number | null {
  if (present == null || expected == null || expected <= 0) return null;
  return Math.round((present / expected) * 100) / 100;
}

export const generateLecturerReportFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => reportFiltersSchema.parse(input))
  .handler(async ({ data }): Promise<ReportResultDTO> => {
    const supabase = createSupabaseServerClient();
    await requireLecturerId(supabase);

    if (data.dateFrom > data.dateTo) {
      throw new Error("Start date must be on or before end date.");
    }

    const { modules } = await loadLecturerContext(supabase);
    const moduleIds = resolveModuleIds(modules, data.moduleId);

    const filters: ReportFiltersDTO = {
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      moduleId: data.moduleId ?? null,
      tutorId: data.tutorId ?? null,
    };

    if (!moduleIds.length) {
      return await emptyReport(data.reportType, filters);
    }

    let query = supabase
      .from("session_claims")
      .select(CLAIM_REPORT_SELECT)
      .in("module_id", moduleIds)
      .gte("session_date", data.dateFrom)
      .lte("session_date", data.dateTo)
      .neq("status", "DRAFT");

    if (data.tutorId) {
      query = query.eq("tutor_id", data.tutorId);
    }

    const { data: claimRows, error: claimErr } = await query.order("session_date", {
      ascending: true,
    });

    if (claimErr) throw new Error(claimErr.message);

    const claims = (claimRows ?? []) as RawClaim[];
    const generatedAt = new Date().toISOString();

    const body = await buildReportBody(
      supabase,
      data.reportType,
      claims,
      filters,
      moduleIds,
      data.tutorId,
    );

    return {
      reportType: data.reportType,
      title: catalogTitle(data.reportType),
      generatedAt,
      filters,
      ...body,
    };
  });

async function emptyReport(
  reportType: ReportType,
  filters: ReportFiltersDTO,
): Promise<ReportResultDTO> {
  const { columns, rows, summary } = await buildReportBody(
    null,
    reportType,
    [],
    filters,
    [],
  );
  return {
    reportType,
    title: catalogTitle(reportType),
    generatedAt: new Date().toISOString(),
    filters,
    columns,
    rows,
    summary,
  };
}

async function buildReportBody(
  supabase: ReturnType<typeof createSupabaseServerClient> | null,
  reportType: ReportType,
  claims: RawClaim[],
  _filters: ReportFiltersDTO,
  moduleIds: string[],
  _tutorId?: string,
): Promise<Pick<ReportResultDTO, "columns" | "rows" | "summary">> {
  switch (reportType) {
    case "attendance_module":
      return buildModuleAttendance(claims);
    case "attendance_tutor":
      return buildTutorAttendance(claims);
    case "attendance_student_participation":
      if (!supabase || !claims.length) {
        return studentParticipationColumns([], 0);
      }
      return buildStudentParticipation(supabase, claims, moduleIds);
    case "claims_approved_hours":
      return buildApprovedHours(claims);
    case "claims_disputed":
      if (!supabase) {
        return disputedClaimsColumns([]);
      }
      return buildDisputedClaims(supabase, claims);
    case "claims_pending":
      return buildPendingClaims(claims);
    case "tutor_workload":
      return buildTutorWorkload(claims);
    case "tutor_performance":
      return buildTutorPerformance(claims);
    case "tutor_attendance_impact":
      return buildAttendanceImpact(claims);
    default:
      return { columns: [], rows: [], summary: null };
  }
}

async function buildStudentParticipation(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  claims: RawClaim[],
  moduleIds: string[],
) {
  const claimIds = claims.map((c) => c.id);
  const claimModule = new Map(claims.map((c) => [c.id, unwrapOne(c.module)?.code ?? "—"]));

  const { data: attendanceRows, error } = await supabase
    .from("session_attendance")
    .select(
      `
      session_id,
      status,
      check_in_time,
      student:students (
        id,
        full_name,
        student_reference,
        email
      )
    `,
    )
    .in("session_id", claimIds);

  if (error) throw new Error(error.message);

  const agg = new Map<
    string,
    {
      name: string;
      reference: string | null;
      email: string | null;
      present: number;
      late: number;
      absent: number;
      excused: number;
      sessions: number;
      modules: Set<string>;
    }
  >();

  for (const row of attendanceRows ?? []) {
    const student = unwrapOne(
      row.student as
        | {
            id: string;
            full_name: string;
            student_reference: string | null;
            email: string | null;
          }
        | {
            id: string;
            full_name: string;
            student_reference: string | null;
            email: string | null;
          }[]
        | null,
    );
    if (!student) continue;

    const sid = student.id;
    const entry = agg.get(sid) ?? {
      name: student.full_name,
      reference: student.student_reference,
      email: student.email,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      sessions: 0,
      modules: new Set<string>(),
    };

    entry.sessions += 1;
    const modCode = claimModule.get(row.session_id as string);
    if (modCode) entry.modules.add(modCode);

    const status = row.status as string;
    if (status === "PRESENT") entry.present += 1;
    else if (status === "LATE") entry.late += 1;
    else if (status === "ABSENT") entry.absent += 1;
    else if (status === "EXCUSED") entry.excused += 1;

    agg.set(sid, entry);
  }

  const rows: ReportRowDTO[] = [...agg.entries()]
    .map(([studentId, r]) => ({
      studentId,
      studentName: r.name,
      studentReference: r.reference,
      studentEmail: r.email,
      sessionsAttended: r.sessions,
      present: r.present,
      late: r.late,
      absent: r.absent,
      excused: r.excused,
      modules: [...r.modules].sort().join(", "),
    }))
    .sort((a, b) => String(a.studentName).localeCompare(String(b.studentName)));

  return studentParticipationColumns(rows, moduleIds.length);
}

function studentParticipationColumns(rows: ReportRowDTO[], moduleCount: number) {
  return {
    columns: [
      { key: "studentName", label: "Student" },
      { key: "studentReference", label: "Reference" },
      { key: "sessionsAttended", label: "Sessions" },
      { key: "present", label: "Present" },
      { key: "late", label: "Late" },
      { key: "absent", label: "Absent" },
      { key: "excused", label: "Excused" },
      { key: "modules", label: "Modules" },
    ],
    rows,
    summary: {
      studentCount: rows.length,
      moduleScope: moduleCount,
      note: "Students with at least one check-in in range; no module enrollment table.",
    },
  };
}

async function buildDisputedClaims(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  claims: RawClaim[],
) {
  const disputedClaims = claims.filter((c) => c.status === "DISPUTED");
  const claimIds = disputedClaims.map((c) => c.id);

  if (!claimIds.length) {
    return disputedClaimsColumns([]);
  }

  const { data: disputeRows, error } = await supabase
    .from("disputes")
    .select(
      "id, claim_id, reason, status, raised_at, resolved_at, resolution_note",
    )
    .in("claim_id", claimIds)
    .order("raised_at", { ascending: false });

  if (error) throw new Error(error.message);

  const claimById = new Map(disputedClaims.map((c) => [c.id, c]));

  const rows: ReportRowDTO[] = (disputeRows ?? []).map((d) => {
    const claim = claimById.get(d.claim_id as string);
    const mod = claim ? unwrapOne(claim.module) : null;
    const tutor = claim ? unwrapOne(claim.tutor) : null;
    return {
      disputeId: d.id,
      sessionDate: claim?.session_date ?? null,
      moduleCode: mod?.code ?? "—",
      tutorName: tutor?.full_name ?? "—",
      hours: claim ? parseHours(claim.hours) : null,
      disputeStatus: d.status,
      reason: d.reason,
      raisedAt: d.raised_at,
      resolvedAt: d.resolved_at,
      resolutionNote: d.resolution_note,
    };
  });

  return disputedClaimsColumns(rows);
}

function disputedClaimsColumns(rows: ReportRowDTO[]) {
  return {
    columns: [
      { key: "sessionDate", label: "Date" },
      { key: "moduleCode", label: "Module" },
      { key: "tutorName", label: "Tutor" },
      { key: "hours", label: "Hours" },
      { key: "disputeStatus", label: "Dispute status" },
      { key: "reason", label: "Reason" },
      { key: "raisedAt", label: "Raised" },
      { key: "resolvedAt", label: "Resolved" },
    ],
    rows,
    summary: { disputeCount: rows.length },
  };
}

function buildModuleAttendance(claims: RawClaim[]) {
  const agg = new Map<
    string,
    { code: string; name: string; present: number; expected: number; sessions: number }
  >();

  for (const c of claims) {
    const mod = unwrapOne(c.module);
    if (!mod) continue;
    const present = c.attendance_present_count;
    const expected = c.attendance_expected_count;
    if (present == null || expected == null || expected <= 0) continue;

    const row = agg.get(c.module_id) ?? {
      code: mod.code,
      name: mod.name,
      present: 0,
      expected: 0,
      sessions: 0,
    };
    row.present += present;
    row.expected += expected;
    row.sessions += 1;
    agg.set(c.module_id, row);
  }

  const rows: ReportRowDTO[] = [...agg.values()]
    .map((r) => ({
      moduleCode: r.code,
      moduleName: r.name,
      sessions: r.sessions,
      totalPresent: r.present,
      totalExpected: r.expected,
      averageRate: attendanceRate(r.present, r.expected),
    }))
    .sort((a, b) => String(a.moduleCode).localeCompare(String(b.moduleCode)));

  return {
    columns: [
      { key: "moduleCode", label: "Module" },
      { key: "moduleName", label: "Name" },
      { key: "sessions", label: "Sessions" },
      { key: "totalPresent", label: "Present" },
      { key: "totalExpected", label: "Expected" },
      { key: "averageRate", label: "Avg rate" },
    ],
    rows,
    summary: summarizeCount(rows.length, "modules"),
  };
}

function buildTutorAttendance(claims: RawClaim[]) {
  const agg = new Map<
    string,
    {
      name: string;
      email: string;
      present: number;
      expected: number;
      sessions: number;
    }
  >();

  for (const c of claims) {
    const tutor = unwrapOne(c.tutor);
    if (!tutor) continue;
    const present = c.attendance_present_count;
    const expected = c.attendance_expected_count;
    if (present == null || expected == null || expected <= 0) continue;

    const row = agg.get(c.tutor_id) ?? {
      name: tutor.full_name,
      email: tutor.email,
      present: 0,
      expected: 0,
      sessions: 0,
    };
    row.present += present;
    row.expected += expected;
    row.sessions += 1;
    agg.set(c.tutor_id, row);
  }

  const rows: ReportRowDTO[] = [...agg.entries()]
    .map(([tutorId, r]) => ({
      tutorId,
      tutorName: r.name,
      tutorEmail: r.email,
      sessions: r.sessions,
      totalPresent: r.present,
      totalExpected: r.expected,
      averageRate: attendanceRate(r.present, r.expected),
    }))
    .sort((a, b) => String(a.tutorName).localeCompare(String(b.tutorName)));

  return {
    columns: [
      { key: "tutorName", label: "Tutor" },
      { key: "tutorEmail", label: "Email" },
      { key: "sessions", label: "Sessions" },
      { key: "totalPresent", label: "Present" },
      { key: "totalExpected", label: "Expected" },
      { key: "averageRate", label: "Avg rate" },
    ],
    rows,
    summary: summarizeCount(rows.length, "tutors"),
  };
}

function buildApprovedHours(claims: RawClaim[]) {
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
    (sum, r) => sum + (typeof r.hours === "number" ? r.hours : 0),
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

function buildPendingClaims(claims: RawClaim[]) {
  const pending = claims.filter((c) => c.status === "PENDING_VERIFICATION");

  const rows: ReportRowDTO[] = pending.map((c) => {
    const mod = unwrapOne(c.module);
    const tutor = unwrapOne(c.tutor);
    return {
      claimId: c.id,
      sessionDate: c.session_date,
      moduleCode: mod?.code ?? "—",
      tutorName: tutor?.full_name ?? "—",
      hours: parseHours(c.hours),
      submittedAt: c.submitted_at,
      present: c.attendance_present_count,
      expected: c.attendance_expected_count,
    };
  });

  return {
    columns: [
      { key: "sessionDate", label: "Date" },
      { key: "moduleCode", label: "Module" },
      { key: "tutorName", label: "Tutor" },
      { key: "hours", label: "Hours" },
      { key: "submittedAt", label: "Submitted" },
      { key: "present", label: "Present" },
      { key: "expected", label: "Expected" },
    ],
    rows,
    summary: { pendingCount: rows.length },
  };
}

function buildTutorWorkload(claims: RawClaim[]) {
  const byTutor = groupClaimsByTutor(claims);
  const rows: ReportRowDTO[] = [];

  for (const [tutorId, list] of byTutor) {
    const tutor = unwrapOne(list[0]?.tutor ?? null);
    const stats = computeTutorStats(list as ClaimStatsRow[]);
    rows.push({
      tutorId,
      tutorName: tutor?.full_name ?? "—",
      tutorEmail: tutor?.email ?? "—",
      totalHours: Math.round(stats.totalHours * 100) / 100,
      sessionsCompleted: stats.sessionsCompleted,
      pendingClaims: stats.pendingClaims,
      scheduleLinked: stats.scheduleLinkedCount,
      activeModules: new Set(list.map((c) => c.module_id)).size,
    });
  }

  rows.sort((a, b) => String(a.tutorName).localeCompare(String(b.tutorName)));

  return {
    columns: [
      { key: "tutorName", label: "Tutor" },
      { key: "tutorEmail", label: "Email" },
      { key: "totalHours", label: "Hours" },
      { key: "sessionsCompleted", label: "Completed" },
      { key: "pendingClaims", label: "Pending" },
      { key: "scheduleLinked", label: "Schedule-linked" },
      { key: "activeModules", label: "Modules" },
    ],
    rows,
    summary: summarizeCount(rows.length, "tutors"),
  };
}

function buildTutorPerformance(claims: RawClaim[]) {
  const byTutor = groupClaimsByTutor(claims);
  const rows: ReportRowDTO[] = [];

  for (const [tutorId, list] of byTutor) {
    const tutor = unwrapOne(list[0]?.tutor ?? null);
    const stats = computeTutorStats(list as ClaimStatsRow[]);
    rows.push({
      tutorId,
      tutorName: tutor?.full_name ?? "—",
      approvalRate: pct(stats.approvalRate),
      attendanceAverage: pct(stats.attendanceAverage),
      sessionsCompleted: stats.sessionsCompleted,
      rejectedClaims: stats.rejectedClaims,
      disputedClaims: stats.disputedClaims,
      pendingClaims: stats.pendingClaims,
      reviewNote:
        "Derived snapshot — formal stored reviews are not in the database.",
    });
  }

  rows.sort((a, b) => String(a.tutorName).localeCompare(String(b.tutorName)));

  return {
    columns: [
      { key: "tutorName", label: "Tutor" },
      { key: "approvalRate", label: "Approval rate" },
      { key: "attendanceAverage", label: "Attendance avg" },
      { key: "sessionsCompleted", label: "Completed" },
      { key: "rejectedClaims", label: "Rejected" },
      { key: "disputedClaims", label: "Disputed" },
      { key: "pendingClaims", label: "Pending" },
    ],
    rows,
    summary: {
      note: "Performance reviews use derived metrics from claims and attendance.",
      tutorCount: rows.length,
    },
  };
}

function buildAttendanceImpact(claims: RawClaim[]) {
  const byTutor = groupClaimsByTutor(claims);
  const rows: ReportRowDTO[] = [];

  for (const [tutorId, list] of byTutor) {
    const tutor = unwrapOne(list[0]?.tutor ?? null);
    const stats = computeTutorStats(list as ClaimStatsRow[]);

    let approvedWithAttendance = 0;
    let approvedTotal = 0;
    let lowAttendanceApproved = 0;

    for (const c of list) {
      if (!(APPROVED_CLAIM_STATUSES as readonly string[]).includes(c.status)) {
        continue;
      }
      approvedTotal++;
      const rate = attendanceRate(
        c.attendance_present_count,
        c.attendance_expected_count,
      );
      if (rate != null) {
        approvedWithAttendance++;
        if (rate < 0.6) lowAttendanceApproved++;
      }
    }

    rows.push({
      tutorId,
      tutorName: tutor?.full_name ?? "—",
      attendanceAverage: pct(stats.attendanceAverage),
      approvalRate: pct(stats.approvalRate),
      approvedSessions: approvedTotal,
      approvedWithAttendanceData: approvedWithAttendance,
      lowAttendanceApproved,
      impactFlag:
        lowAttendanceApproved > 0 && approvedTotal > 0 ? "Review" : "OK",
    });
  }

  rows.sort((a, b) => String(a.tutorName).localeCompare(String(b.tutorName)));

  return {
    columns: [
      { key: "tutorName", label: "Tutor" },
      { key: "attendanceAverage", label: "Attendance avg" },
      { key: "approvalRate", label: "Approval rate" },
      { key: "approvedSessions", label: "Approved sessions" },
      { key: "lowAttendanceApproved", label: "Low attendance approved" },
      { key: "impactFlag", label: "Flag" },
    ],
    rows,
    summary: {
      tutorsFlagged: rows.filter((r) => r.impactFlag === "Review").length,
    },
  };
}

function groupClaimsByTutor(claims: RawClaim[]): Map<string, RawClaim[]> {
  const map = new Map<string, RawClaim[]>();
  for (const c of claims) {
    const list = map.get(c.tutor_id) ?? [];
    list.push(c);
    map.set(c.tutor_id, list);
  }
  return map;
}

function summarizeCount(count: number, label: string): ReportRowDTO {
  return { [`${label}Count`]: count };
}
