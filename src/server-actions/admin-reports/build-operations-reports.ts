import type { ReportRowDTO } from "#/lib/report-types";
import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { buildIntegrityIssues } from "#/server-actions/lecturer-attendance/build-integrity-issues";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import { loadClaimsInRange } from "./load-report-claims";
import type { BuildCtx } from "./report-build-context";

export async function buildScheduleUtilization(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ctx: BuildCtx,
) {
  if (!ctx.moduleIds.length) {
    return scheduleUtilizationColumns([]);
  }

  const rangeStart = `${ctx.dateFrom}T00:00:00.000Z`;
  const rangeEnd = `${ctx.dateTo}T23:59:59.999Z`;

  const { data: sessions, error } = await supabase
    .from("scheduled_sessions")
    .select(
      `
      id,
      starts_at,
      status,
      module:modules ( code )
    `,
    )
    .in("module_id", ctx.moduleIds)
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd);

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

export function scheduleUtilizationColumns(rows: ReportRowDTO[]) {
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

export async function buildAttendanceIntegrity(
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

    const [{ data: attendance }, { data: unverifiedRows }] = await Promise.all([
      supabase
        .from("session_attendance")
        .select("session_id")
        .in("session_id", claimIds)
        .is("deleted_at", null),
      supabase
        .from("session_attendance")
        .select("session_id")
        .in("session_id", claimIds)
        .eq("is_verified", false)
        .is("deleted_at", null),
    ]);

    for (const row of attendance ?? []) {
      const cid = row.session_id as string;
      scanCountByClaim.set(cid, (scanCountByClaim.get(cid) ?? 0) + 1);
    }

    for (const row of unverifiedRows ?? []) {
      const cid = row.session_id as string;
      unverifiedByClaim.set(cid, (unverifiedByClaim.get(cid) ?? 0) + 1);
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
