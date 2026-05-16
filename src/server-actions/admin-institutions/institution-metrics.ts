import { subDays } from "date-fns";
import type { createSupabaseServerClient } from "#/lib/supabase-server";
import { buildTrendSeries } from "#/server-actions/lecturer-attendance/build-trend-series";
import {
  firstApproveByClaim,
  median,
  turnaroundHours,
  type VerificationActionRow,
} from "#/server-actions/lecturer-analytics/helpers";
import {
  computeTutorStats,
  isTutorInactive,
  type ClaimStatsRow,
} from "#/server-actions/lecturer-tutors/compute-tutor-stats";
import type { InstitutionDashboardDTO } from "./types";

const LOOKBACK_DAYS = 30;
const STATUS_ORDER = [
  "DRAFT",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "APPROVED",
  "DISPUTED",
  "REJECTED",
] as const;

export async function loadInstitutionDashboard(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  institutionId: string,
  moduleIds: string[],
  now: Date = new Date(),
): Promise<InstitutionDashboardDTO> {
  const emptyVerification = {
    pendingVerificationCount: 0,
    medianTurnaroundHours: null,
    openDisputes: 0,
    claimsByStatus: STATUS_ORDER.map((status) => ({ status, count: 0 })),
  };

  if (!moduleIds.length) {
    return {
      activeUsers: 0,
      activeTutors: 0,
      totalLecturers: 0,
      totalClaims: 0,
      attendanceTrend: buildTrendSeries([], LOOKBACK_DAYS, now),
      verification: emptyVerification,
    };
  }

  const trendFrom = subDays(now, LOOKBACK_DAYS).toISOString().slice(0, 10);

  const [
    usersRes,
    tutorsRes,
    lecturersCountRes,
    claimsCountRes,
    trendClaimsRes,
    claimsForStatusRes,
    pendingCountRes,
    disputesRes,
    verificationActionsRes,
    submittedRowsRes,
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("is_active", true),
    supabase
      .from("users")
      .select("id, is_active, last_login_at")
      .eq("institution_id", institutionId)
      .eq("role", "TUTOR"),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("role", "LECTURER"),
    supabase
      .from("session_claims")
      .select("id", { count: "exact", head: true })
      .in("module_id", moduleIds),
    supabase
      .from("session_claims")
      .select("session_date, attendance_present_count, attendance_expected_count")
      .in("module_id", moduleIds)
      .gte("session_date", trendFrom)
      .neq("status", "DRAFT"),
    supabase
      .from("session_claims")
      .select("status")
      .in("module_id", moduleIds),
    supabase
      .from("session_claims")
      .select("id", { count: "exact", head: true })
      .in("module_id", moduleIds)
      .eq("status", "PENDING_VERIFICATION"),
    supabase
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("status", "OPEN"),
    supabase
      .from("verification_actions")
      .select("claim_id, actor_id, action_type, to_status, acted_at")
      .order("acted_at", { ascending: true }),
    supabase
      .from("session_claims")
      .select("id, submitted_at")
      .in("module_id", moduleIds)
      .not("submitted_at", "is", null),
  ]);

  const errors = [
    usersRes.error,
    tutorsRes.error,
    lecturersCountRes.error,
    claimsCountRes.error,
    trendClaimsRes.error,
    claimsForStatusRes.error,
    pendingCountRes.error,
    disputesRes.error,
    verificationActionsRes.error,
    submittedRowsRes.error,
  ].filter(Boolean);
  if (errors.length) {
    throw new Error(errors.map((e) => e!.message).join(" · "));
  }

  const tutorRows = tutorsRes.data ?? [];
  const tutorIds = tutorRows.map((t) => t.id as string);

  let activeTutors = 0;
  if (tutorIds.length) {
    const { data: tutorClaims, error: tcErr } = await supabase
      .from("session_claims")
      .select(
        "id, tutor_id, status, submitted_at, attendance_present_count, attendance_expected_count, hours, session_date, updated_at, source_scheduled_session_id",
      )
      .in("module_id", moduleIds)
      .in("tutor_id", tutorIds);

    if (tcErr) throw new Error(tcErr.message);

    const claimsByTutor = new Map<string, ClaimStatsRow[]>();
    for (const row of tutorClaims ?? []) {
      const tid = row.tutor_id as string;
      const list = claimsByTutor.get(tid) ?? [];
      list.push(row as ClaimStatsRow);
      claimsByTutor.set(tid, list);
    }

    for (const tutor of tutorRows) {
      const tid = tutor.id as string;
      const stats = computeTutorStats(claimsByTutor.get(tid) ?? []);
      if (
        !isTutorInactive(
          tutor.is_active as boolean,
          tutor.last_login_at as string | null,
          stats.lastActivityAt,
          now,
        )
      ) {
        activeTutors += 1;
      }
    }
  }

  const statusCounts = new Map<string, number>();
  for (const row of claimsForStatusRes.data ?? []) {
    const s = row.status as string;
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
  }

  const { data: allClaimIdRows, error: idErr } = await supabase
    .from("session_claims")
    .select("id")
    .in("module_id", moduleIds);
  if (idErr) throw new Error(idErr.message);

  const institutionClaimIds = new Set(
    (allClaimIdRows ?? []).map((r) => r.id as string),
  );

  const actions = (verificationActionsRes.data ?? []).filter((a) =>
    institutionClaimIds.has(a.claim_id as string),
  ) as VerificationActionRow[];

  const submittedByClaim = new Map<string, string>();
  for (const row of submittedRowsRes.data ?? []) {
    if (row.submitted_at) {
      submittedByClaim.set(row.id as string, row.submitted_at as string);
    }
  }

  const firstApprove = firstApproveByClaim(actions);
  const turnaroundSamples: number[] = [];
  for (const [claimId, approvedAt] of firstApprove) {
    const submitted = submittedByClaim.get(claimId);
    if (submitted) {
      turnaroundSamples.push(turnaroundHours(submitted, approvedAt));
    }
  }

  const attendanceTrend = buildTrendSeries(
    (trendClaimsRes.data ?? []) as {
      session_date: string;
      attendance_present_count: number | null;
      attendance_expected_count: number | null;
    }[],
    LOOKBACK_DAYS,
    now,
  );

  return {
    activeUsers: usersRes.count ?? 0,
    activeTutors,
    totalLecturers: lecturersCountRes.count ?? 0,
    totalClaims: claimsCountRes.count ?? 0,
    attendanceTrend,
    verification: {
      pendingVerificationCount: pendingCountRes.count ?? 0,
      medianTurnaroundHours: median(turnaroundSamples),
      openDisputes: disputesRes.count ?? 0,
      claimsByStatus: STATUS_ORDER.map((status) => ({
        status,
        count: statusCounts.get(status) ?? 0,
      })),
    },
  };
}
