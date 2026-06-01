import type { ReportRowDTO } from "#/lib/report-types";
import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { unwrapOne } from "#/server-actions/lecturer-verification/unwrap";
import { APPROVED_CLAIM_STATUSES } from "./constants";
import { hoursBetween, parseHours } from "./helpers";
import { loadClaimsInRange } from "./load-report-claims";
import type { BuildCtx } from "./report-build-context";

export async function buildAdminApprovalQueue(
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

export async function buildInstitutionApprovedHours(
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

export async function buildPipelineSnapshot(
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

export async function buildDisputesRegister(
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
