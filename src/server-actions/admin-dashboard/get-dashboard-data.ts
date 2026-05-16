import { createServerFn } from "@tanstack/react-start";
import {
  addDays,
  endOfDay,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { buildIntegrityIssues } from "#/server-actions/lecturer-attendance/build-integrity-issues";
import { buildActivityFeed } from "#/server-actions/lecturer-dashboard/build-activity-feed";
import { buildAttendanceAlerts } from "#/server-actions/lecturer-dashboard/build-attendance-alerts";
import {
  ALERT_LOOKBACK_DAYS,
  MISSING_REGISTER_LOOKBACK_DAYS,
} from "#/server-actions/lecturer-dashboard/constants";
import { loadEvidenceByClaim } from "#/server-actions/lecturer-dashboard/load-evidence-by-claim";
import type {
  ActivityClaimRow,
  AlertClaimRow,
  AuditRow,
  DisputeRow,
  LecturerModuleDTO,
} from "#/server-actions/lecturer-dashboard/types";
import { unwrapOne } from "#/server-actions/lecturer-dashboard/unwrap";
import { loadClaimCounts } from "#/server-actions/lecturer-verification/load-claim-counts";
import {
  computeTutorStats,
  isTutorInactive,
  type ClaimStatsRow,
} from "#/server-actions/lecturer-tutors/compute-tutor-stats";
import { emptyAdminDashboard } from "./empty-dashboard";
import type {
  AdminDashboardDataDTO,
  AdminDeadlineDTO,
  AdminLecturerActivityDTO,
} from "./types";

const STALLED_DAYS = 7;
const LECTURER_ACTIVITY_LIMIT = 10;

function sumHours(rows: { hours: number | string }[]): number {
  const total = rows.reduce((s, r) => {
    const h =
      typeof r.hours === "string" ? Number.parseFloat(r.hours) : Number(r.hours);
    return s + (Number.isFinite(h) ? h : 0);
  }, 0);
  return Math.round(total * 10) / 10;
}

export const getAdminDashboardDataFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminDashboardDataDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    const alertFrom = format(subDays(now, ALERT_LOOKBACK_DAYS), "yyyy-MM-dd");
    const registerFrom = format(
      subDays(now, MISSING_REGISTER_LOOKBACK_DAYS),
      "yyyy-MM-dd",
    );
    const stalledBefore = subDays(now, STALLED_DAYS).toISOString();
    const tomorrowStart = startOfDay(addDays(now, 1)).toISOString();
    const tomorrowEnd = endOfDay(addDays(now, 1)).toISOString();

    const { data: institution, error: instErr } = await supabase
      .from("institutions")
      .select("name")
      .eq("id", institutionId)
      .maybeSingle();

    if (instErr) throw new Error(instErr.message);

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("institution_id", institutionId)
      .order("code", { ascending: true });

    if (modErr) throw new Error(modErr.message);

    const moduleRows = (modules ?? []) as LecturerModuleDTO[];
    const moduleIds = moduleRows.map((m) => m.id);

    if (!moduleIds.length) {
      return {
        ...emptyAdminDashboard(startStr, endStr),
        institutionName: (institution?.name as string | null) ?? null,
      };
    }

    const [
      pendingCountRes,
      verifiedCountRes,
      approvedCountRes,
      openDisputesRes,
      stalledCountRes,
      scheduleChangesRes,
      weekSessionsRes,
      approvedHoursRes,
      alertClaimsRes,
      activityClaimsRes,
      auditsRes,
      disputesRes,
      verificationActionsRes,
      tutorsRes,
      lecturersCountRes,
      tomorrowSessionsRes,
      stalledListRes,
    ] = await Promise.all([
      supabase
        .from("session_claims")
        .select("id", { count: "exact", head: true })
        .in("module_id", moduleIds)
        .eq("status", "PENDING_VERIFICATION"),
      supabase
        .from("session_claims")
        .select("id", { count: "exact", head: true })
        .in("module_id", moduleIds)
        .eq("status", "VERIFIED"),
      supabase
        .from("session_claims")
        .select("id", { count: "exact", head: true })
        .in("module_id", moduleIds)
        .eq("status", "APPROVED"),
      supabase
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .eq("status", "OPEN"),
      supabase
        .from("session_claims")
        .select("id", { count: "exact", head: true })
        .in("module_id", moduleIds)
        .in("status", ["PENDING_VERIFICATION", "VERIFIED"])
        .not("submitted_at", "is", null)
        .lt("submitted_at", stalledBefore),
      supabase
        .from("schedule_change_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING"),
      supabase
        .from("scheduled_sessions")
        .select("id", { count: "exact", head: true })
        .in("module_id", moduleIds)
        .eq("status", "SCHEDULED")
        .gte("starts_at", weekStart.toISOString())
        .lte("starts_at", weekEnd.toISOString()),
      supabase
        .from("session_claims")
        .select("hours")
        .in("module_id", moduleIds)
        .in("status", ["VERIFIED", "APPROVED"]),
      supabase
        .from("session_claims")
        .select(
          "id, module_id, session_date, status, attendance_present_count, attendance_expected_count",
        )
        .in("module_id", moduleIds)
        .gte("session_date", alertFrom)
        .neq("status", "DRAFT"),
      supabase
        .from("session_claims")
        .select(
          `
          id,
          session_date,
          status,
          submitted_at,
          updated_at,
          module:modules ( code ),
          tutor:users!session_claims_tutor_id_fkey ( full_name, email )
        `,
        )
        .in("module_id", moduleIds)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("audit_logs")
        .select("id, entity_id, event, payload, created_at")
        .eq("institution_id", institutionId)
        .eq("entity_type", "SESSION_CLAIM")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("disputes")
        .select(
          `
          id,
          claim_id,
          reason,
          raised_at,
          claim:session_claims (
            module:modules ( code ),
            tutor:users!session_claims_tutor_id_fkey ( full_name, email )
          )
        `,
        )
        .eq("status", "OPEN")
        .order("raised_at", { ascending: false })
        .limit(10),
      supabase
        .from("verification_actions")
        .select(
          `
          id,
          action_type,
          acted_at,
          claim:session_claims (
            module:modules ( code )
          ),
          actor:users!verification_actions_actor_id_fkey ( full_name )
        `,
        )
        .order("acted_at", { ascending: false })
        .limit(LECTURER_ACTIVITY_LIMIT),
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
        .from("scheduled_sessions")
        .select("id", { count: "exact", head: true })
        .in("module_id", moduleIds)
        .eq("status", "SCHEDULED")
        .gte("starts_at", tomorrowStart)
        .lte("starts_at", tomorrowEnd),
      supabase
        .from("session_claims")
        .select("id, submitted_at, module:modules ( code )")
        .in("module_id", moduleIds)
        .in("status", ["PENDING_VERIFICATION", "VERIFIED"])
        .not("submitted_at", "is", null)
        .lt("submitted_at", stalledBefore)
        .order("submitted_at", { ascending: true })
        .limit(5),
    ]);

    const errors = [
      pendingCountRes.error,
      verifiedCountRes.error,
      approvedCountRes.error,
      openDisputesRes.error,
      stalledCountRes.error,
      scheduleChangesRes.error,
      weekSessionsRes.error,
      approvedHoursRes.error,
      alertClaimsRes.error,
      activityClaimsRes.error,
      auditsRes.error,
      disputesRes.error,
      verificationActionsRes.error,
      tutorsRes.error,
      lecturersCountRes.error,
      tomorrowSessionsRes.error,
      stalledListRes.error,
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
        const inactive = isTutorInactive(
          tutor.is_active as boolean,
          tutor.last_login_at as string | null,
          stats.lastActivityAt,
          now,
        );
        if (!inactive) activeTutors += 1;
      }
    }

    const alertClaimRows = (alertClaimsRes.data ?? []) as AlertClaimRow[];
    const alertClaimIds = [...new Set(alertClaimRows.map((r) => r.id))];

    const { evidenceClaimIds } = await loadEvidenceByClaim(
      supabase,
      alertClaimIds,
    );

    const attendanceAlerts = buildAttendanceAlerts(
      moduleRows,
      alertClaimRows,
      evidenceClaimIds,
    );

    const registerAlertClaims = alertClaimRows.filter(
      (r) => r.session_date >= registerFrom,
    );

    const integrityClaimIds = [
      ...new Set(registerAlertClaims.map((r) => r.id)),
    ];

    const { scanCountByClaim } = await loadClaimCounts(
      supabase,
      integrityClaimIds,
    );

    const unverifiedByClaim = new Map<string, number>();
    if (integrityClaimIds.length) {
      const { data: unverifiedRows, error: uvErr } = await supabase
        .from("session_attendance")
        .select("session_id")
        .in("session_id", integrityClaimIds)
        .eq("is_verified", false);

      if (uvErr) throw new Error(uvErr.message);

      for (const row of unverifiedRows ?? []) {
        const id = row.session_id as string;
        unverifiedByClaim.set(id, (unverifiedByClaim.get(id) ?? 0) + 1);
      }
    }

    const moduleById = new Map(moduleRows.map((m) => [m.id, m]));
    const integrityClaims = registerAlertClaims.map((row) => ({
      id: row.id,
      session_date: row.session_date,
      status: row.status,
      attendance_present_count: row.attendance_present_count,
      moduleCode: moduleById.get(row.module_id)?.code ?? "—",
    }));

    const integrityIssues = buildIntegrityIssues(
      integrityClaims,
      scanCountByClaim,
      evidenceClaimIds,
      unverifiedByClaim,
    );

    const activityFeed = buildActivityFeed(
      (activityClaimsRes.data ?? []) as ActivityClaimRow[],
      (auditsRes.data ?? []) as AuditRow[],
      (disputesRes.data ?? []) as DisputeRow[],
      [],
    );

    const lecturerActivity: AdminLecturerActivityDTO[] = [];
    for (const row of verificationActionsRes.data ?? []) {
      const claim = unwrapOne(
        row.claim as
          | { module: { code: string } | { code: string }[] | null }
          | { module: { code: string } | { code: string }[] | null }[]
          | null,
      );
      const actor = unwrapOne(
        row.actor as
          | { full_name: string }
          | { full_name: string }[]
          | null,
      );
      const moduleCode = unwrapOne(claim?.module ?? null)?.code ?? null;
      const actorName = actor?.full_name ?? "Lecturer";
      const actionType = row.action_type as string;
      lecturerActivity.push({
        id: row.id as string,
        at: row.acted_at as string,
        actorName,
        actionType,
        moduleCode,
        message: `${actorName} ${actionType.replace(/_/g, " ").toLowerCase()}${moduleCode ? ` on ${moduleCode}` : ""}.`,
      });
    }

    const deadlines: AdminDeadlineDTO[] = [];
    const tomorrowCount = tomorrowSessionsRes.count ?? 0;
    if (tomorrowCount > 0) {
      deadlines.push({
        id: "sessions-tomorrow",
        kind: "SESSIONS_TOMORROW",
        label: `${tomorrowCount} session${tomorrowCount === 1 ? "" : "s"} scheduled tomorrow`,
        count: tomorrowCount,
        at: format(addDays(now, 1), "yyyy-MM-dd"),
      });
    }

    const openDisputes = openDisputesRes.count ?? 0;
    if (openDisputes > 0) {
      deadlines.push({
        id: "open-disputes",
        kind: "OPEN_DISPUTE",
        label: `${openDisputes} open dispute${openDisputes === 1 ? "" : "s"} need review`,
        count: openDisputes,
      });
    }

    for (const row of stalledListRes.data ?? []) {
      const mod = unwrapOne(
        row.module as { code: string } | { code: string }[] | null,
      );
      deadlines.push({
        id: `stalled-${row.id}`,
        kind: "STALLED_CLAIM",
        label: `${mod?.code ?? "Claim"} stuck over ${STALLED_DAYS} days`,
        at: row.submitted_at as string,
      });
    }

    const pendingApprovalsCount = pendingCountRes.count ?? 0;
    const verifiedCount = verifiedCountRes.count ?? 0;
    const approvedCount = approvedCountRes.count ?? 0;

    return {
      institutionName: (institution?.name as string | null) ?? null,
      pendingApprovalsCount,
      verifiedClaimsCount: verifiedCount + approvedCount,
      activeSessionsCount: weekSessionsRes.count ?? 0,
      approvedHours: sumHours(
        (approvedHoursRes.data ?? []) as { hours: number | string }[],
      ),
      pipeline: {
        pendingLecturerVerifications: pendingApprovalsCount,
        pendingAdminApprovals: verifiedCount,
        openDisputes,
        stalledClaims: stalledCountRes.count ?? 0,
        pendingScheduleChanges: scheduleChangesRes.count ?? 0,
      },
      attendanceAlerts,
      integrityIssues,
      activityFeed,
      lecturerActivity,
      deadlines,
      analyticsSummary: {
        totalModules: moduleRows.length,
        totalTutors: tutorRows.length,
        activeTutors,
        totalLecturers: lecturersCountRes.count ?? 0,
        claimsPending: pendingApprovalsCount,
        claimsVerified: verifiedCount,
        claimsApproved: approvedCount,
        openDisputes,
      },
      weekStart: startStr,
      weekEnd: endStr,
    };
  },
);
