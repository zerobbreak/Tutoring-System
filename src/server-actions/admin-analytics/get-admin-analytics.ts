import { createServerFn } from "@tanstack/react-start";
import {
  differenceInHours,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { buildTrendSeries } from "#/server-actions/lecturer-attendance/build-trend-series";
import {
  computeTutorStats,
  isTutorInactive,
  type ClaimStatsRow,
} from "#/server-actions/lecturer-tutors/compute-tutor-stats";
import {
  ANALYTICS_LOOKBACK_DAYS,
  CLAIM_ANALYTICS_SELECT,
  HIGH_RISK_ATTENDANCE_THRESHOLD,
  HIGH_RISK_DISPUTE_RATE,
  HIGH_RISK_PENDING_COUNT,
  STATUS_FUNNEL_ORDER,
  STATUS_LABELS,
} from "#/server-actions/lecturer-analytics/constants";
import {
  ACTION_TYPE_LABELS,
  attendanceConsistencyScore,
  buildClaimsVolumeTrend,
  buildHeatmapWeekStarts,
  claimAttendanceRate,
  computePerformanceScore,
  firstApproveByClaim,
  median,
  turnaroundHours,
  weekKeyForDate,
  type ClaimRow,
  type VerificationActionRow,
} from "#/server-actions/lecturer-analytics/helpers";
import type {
  ActionMixItemDTO,
  ModuleAnalyticsRowDTO,
  ModuleHeatCellDTO,
  PendingAgeBucketDTO,
  VerificationFunnelStepDTO,
  WeeklyActionCountDTO,
  WorkloadBarDTO,
} from "#/server-actions/lecturer-analytics/types";
import type {
  AdminAnalyticsDTO,
  AdminTutorAnalyticsRowDTO,
  ComparisonSliceDTO,
  LecturerAnalyticsRowDTO,
} from "./types";
import {
  buildSubmittedByClaim,
  buildWorkflowStageTimings,
  firstAdminApprovedByClaim,
  firstVerifiedByClaim,
  mapOnboardingCounts,
} from "./workflow-stages";

function emptyAdminAnalytics(): AdminAnalyticsDTO {
  const funnel = STATUS_FUNNEL_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status] ?? status,
    count: 0,
  }));
  return {
    institutionName: null,
    lookbackDays: ANALYTICS_LOOKBACK_DAYS,
    kpis: {
      pendingVerificationCount: 0,
      medianTurnaroundHours: null,
      averageAttendanceRate: null,
      openDisputes: 0,
      scheduleCompletionRate: null,
      pendingAdminApprovals: 0,
      activeScheduledSessions: 0,
    },
    attendanceTrend: [],
    claimsVolumeTrend: [],
    tutors: [],
    modules: [],
    lecturers: [],
    moduleHeatMap: [],
    workflow: {
      funnel,
      pendingAges: [
        { bucket: "0-1", label: "< 1 day", count: 0 },
        { bucket: "1-3", label: "1–3 days", count: 0 },
        { bucket: "3-7", label: "3–7 days", count: 0 },
        { bucket: "7+", label: "7+ days", count: 0 },
      ],
      actionsByWeek: [],
      actionMix: [],
      verificationActionsTotal: 0,
      stageTimings: [
        {
          stage: "SUBMIT_TO_VERIFY",
          label: "Submit → lecturer verify",
          medianHours: null,
        },
        {
          stage: "VERIFY_TO_APPROVE",
          label: "Verify → admin approve",
          medianHours: null,
        },
        {
          stage: "SUBMIT_TO_APPROVE",
          label: "Submit → final approval",
          medianHours: null,
        },
      ],
      pendingAdminApprovals: 0,
      disputeCountInPeriod: 0,
    },
    workloadDistribution: [],
    onboarding: { tutors: mapOnboardingCounts([], "TUTOR"), lecturers: mapOnboardingCounts([], "LECTURER") },
    comparisons: { byTerm: [], byCampus: [] },
    institution: {
      activeScheduledSessions: 0,
      utilizationRate: null,
      totalModules: 0,
      activeTutors: 0,
    },
  };
}

function buildComparisonSlice(
  id: string,
  label: string,
  claims: ClaimRow[],
  scheduledExpected: number,
  scheduledCompleted: number,
): ComparisonSliceDTO {
  let pendingCount = 0;
  const nonDraft = claims.filter((c) => c.status !== "DRAFT");

  for (const c of claims) {
    if (c.status === "PENDING_VERIFICATION") pendingCount += 1;
  }

  return {
    id,
    label,
    sessionCount: nonDraft.length,
    utilizationRate:
      scheduledExpected > 0
        ? Math.round((scheduledCompleted / scheduledExpected) * 100) / 100
        : null,
    pendingCount,
  };
}

export const getAdminAnalyticsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminAnalyticsDTO> => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);
    const now = new Date();
    const trendFrom = format(
      subDays(now, ANALYTICS_LOOKBACK_DAYS),
      "yyyy-MM-dd",
    );
    const scheduleFrom = subDays(now, ANALYTICS_LOOKBACK_DAYS).toISOString();
    const actionsFrom = subDays(now, ANALYTICS_LOOKBACK_DAYS).toISOString();
    const disputesFrom = subDays(now, ANALYTICS_LOOKBACK_DAYS).toISOString();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const { data: institution, error: instErr } = await supabase
      .from("institutions")
      .select("name")
      .eq("id", institutionId)
      .maybeSingle();
    if (instErr) throw new Error(instErr.message);

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name, lecturer_id, academic_term_id")
      .eq("institution_id", institutionId)
      .order("code", { ascending: true });
    if (modErr) throw new Error(modErr.message);

    const moduleRows = (modules ?? []).map((m) => ({
      id: m.id as string,
      code: m.code as string,
      name: m.name as string,
      lecturerId: m.lecturer_id as string,
      academicTermId: (m.academic_term_id as string | null) ?? null,
    }));
    const moduleIds = moduleRows.map((m) => m.id);
    const moduleIdToTerm = new Map(
      moduleRows.map((m) => [m.id, m.academicTermId]),
    );

    if (!moduleIds.length) {
      return {
        ...emptyAdminAnalytics(),
        institutionName: (institution?.name as string | null) ?? null,
      };
    }

    const lecturerIds = [...new Set(moduleRows.map((m) => m.lecturerId))];

    const [
      claimsRes,
      pipelineClaimsRes,
      disputesRes,
      openDisputesRes,
      actionsRes,
      scheduledRes,
      pendingVerifyRes,
      pendingAdminRes,
      weekScheduledRes,
      termsRes,
      campusesRes,
      onboardingRes,
      tutorUsersRes,
    ] = await Promise.all([
      supabase
        .from("session_claims")
        .select(CLAIM_ANALYTICS_SELECT)
        .in("module_id", moduleIds)
        .gte("session_date", trendFrom)
        .order("session_date", { ascending: true }),
      supabase
        .from("session_claims")
        .select("id, status, submitted_at, module_id, tutor_id")
        .in("module_id", moduleIds),
      supabase
        .from("disputes")
        .select("id, claim_id, status, raised_at")
        .gte("raised_at", disputesFrom)
        .order("raised_at", { ascending: false }),
      supabase
        .from("disputes")
        .select("claim_id")
        .eq("status", "OPEN"),
      supabase
        .from("verification_actions")
        .select("claim_id, actor_id, action_type, to_status, acted_at")
        .gte("acted_at", actionsFrom)
        .order("acted_at", { ascending: true }),
      supabase
        .from("scheduled_sessions")
        .select("id, module_id, status, venue_id")
        .in("module_id", moduleIds)
        .neq("status", "CANCELLED")
        .gte("starts_at", scheduleFrom),
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
        .from("scheduled_sessions")
        .select("id", { count: "exact", head: true })
        .in("module_id", moduleIds)
        .neq("status", "CANCELLED")
        .gte("starts_at", weekStart.toISOString())
        .lte("starts_at", weekEnd.toISOString()),
      supabase
        .from("academic_terms")
        .select("id, label, academic_year")
        .eq("institution_id", institutionId)
        .order("start_date", { ascending: false }),
      supabase
        .from("campuses")
        .select("id, name, code")
        .eq("institution_id", institutionId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("users")
        .select("user_status, onboarding_step, role")
        .eq("institution_id", institutionId)
        .in("role", ["TUTOR", "LECTURER"]),
      supabase
        .from("users")
        .select("id, full_name, last_login_at, is_active")
        .eq("institution_id", institutionId)
        .eq("role", "TUTOR"),
    ]);

    const errors = [
      claimsRes.error,
      pipelineClaimsRes.error,
      disputesRes.error,
      openDisputesRes.error,
      actionsRes.error,
      scheduledRes.error,
      pendingVerifyRes.error,
      pendingAdminRes.error,
      weekScheduledRes.error,
      termsRes.error,
      campusesRes.error,
      onboardingRes.error,
      tutorUsersRes.error,
    ].filter(Boolean);
    if (errors.length) {
      throw new Error(errors.map((e) => e!.message).join(" · "));
    }

    const claims = (claimsRes.data ?? []) as ClaimRow[];
    const pipelineClaims = pipelineClaimsRes.data ?? [];
    const institutionClaimIds = new Set(
      pipelineClaims.map((c) => c.id as string),
    );
    const claimIdToModule = new Map(
      pipelineClaims.map((c) => [c.id as string, c.module_id as string]),
    );
    const claimIdToTutor = new Map(
      pipelineClaims.map((c) => [c.id as string, c.tutor_id as string]),
    );

    const disputes = (disputesRes.data ?? []).filter((d) =>
      institutionClaimIds.has(d.claim_id as string),
    );
    const openDisputes = (openDisputesRes.data ?? []).filter((d) =>
      institutionClaimIds.has(d.claim_id as string),
    ).length;
    const disputeCountInPeriod = disputes.length;

    const allActions = (actionsRes.data ?? []) as VerificationActionRow[];
    const claimActions = allActions.filter((a) =>
      institutionClaimIds.has(a.claim_id),
    );
    const firstApproveAt = firstApproveByClaim(claimActions);
    const verifiedAt = firstVerifiedByClaim(claimActions);
    const adminApprovedAt = firstAdminApprovedByClaim(claimActions);
    const submittedByClaim = buildSubmittedByClaim(
      pipelineClaims.map((c) => ({
        id: c.id as string,
        submitted_at: c.submitted_at as string | null,
      })),
    );

    const stageTimings = buildWorkflowStageTimings(
      submittedByClaim,
      verifiedAt,
      adminApprovedAt,
    );

    const tutorIds = [...new Set(claims.map((c) => c.tutor_id))];
    const tutorNameById = new Map<string, string>();
    const tutorLoginById = new Map<string, string | null>();
    for (const u of tutorUsersRes.data ?? []) {
      tutorNameById.set(u.id as string, u.full_name as string);
      tutorLoginById.set(u.id as string, u.last_login_at as string | null);
    }
    if (tutorIds.length) {
      const missing = tutorIds.filter((id) => !tutorNameById.has(id));
      if (missing.length) {
        const { data: extraTutors, error: exErr } = await supabase
          .from("users")
          .select("id, full_name, last_login_at")
          .in("id", missing);
        if (exErr) throw new Error(exErr.message);
        for (const u of extraTutors ?? []) {
          tutorNameById.set(u.id as string, u.full_name as string);
          tutorLoginById.set(u.id as string, u.last_login_at as string | null);
        }
      }
    }

    const lecturerNameById = new Map<string, string>();
    if (lecturerIds.length) {
      const { data: lecturerUsers, error: lecErr } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", lecturerIds);
      if (lecErr) throw new Error(lecErr.message);
      for (const u of lecturerUsers ?? []) {
        lecturerNameById.set(u.id as string, u.full_name as string);
      }
    }

    const scheduledExpected = (scheduledRes.data ?? []).length;
    const scheduledIds = new Set(
      (scheduledRes.data ?? []).map((s) => s.id as string),
    );
    const scheduledCompleted = claims.filter(
      (c) =>
        c.source_scheduled_session_id &&
        scheduledIds.has(c.source_scheduled_session_id) &&
        c.status !== "DRAFT",
    ).length;
    const scheduleCompletionRate =
      scheduledExpected > 0 ? scheduledCompleted / scheduledExpected : null;

    const attendanceTrend = buildTrendSeries(
      claims,
      ANALYTICS_LOOKBACK_DAYS,
      now,
    );

    let totalPresent = 0;
    let totalExpected = 0;
    const claimsVolumeTrend = buildClaimsVolumeTrend(
      claims,
      ANALYTICS_LOOKBACK_DAYS,
      now,
      firstApproveAt,
    );

    const turnaroundHoursList: number[] = [];

    for (const claim of claims) {
      const rate = claimAttendanceRate(claim);
      if (rate != null) {
        totalPresent += claim.attendance_present_count!;
        totalExpected += claim.attendance_expected_count!;
      }
      if (claim.submitted_at) {
        const approvedAt = firstApproveAt.get(claim.id);
        if (approvedAt) {
          turnaroundHoursList.push(
            turnaroundHours(claim.submitted_at, approvedAt),
          );
        }
      }
    }

    const averageAttendanceRate =
      totalExpected > 0
        ? Math.round((totalPresent / totalExpected) * 100) / 100
        : null;

    const pendingVerificationCount = pendingVerifyRes.count ?? 0;
    const pendingAdminApprovals = pendingAdminRes.count ?? 0;

    const pendingClaims = pipelineClaims.filter(
      (c) => c.status === "PENDING_VERIFICATION",
    );

    const pendingAges: PendingAgeBucketDTO[] = [
      { bucket: "0-1", label: "< 1 day", count: 0 },
      { bucket: "1-3", label: "1–3 days", count: 0 },
      { bucket: "3-7", label: "3–7 days", count: 0 },
      { bucket: "7+", label: "7+ days", count: 0 },
    ];

    for (const claim of pendingClaims) {
      if (!claim.submitted_at) continue;
      const hours = differenceInHours(now, parseISO(claim.submitted_at));
      if (hours < 24) pendingAges[0].count += 1;
      else if (hours < 72) pendingAges[1].count += 1;
      else if (hours < 168) pendingAges[2].count += 1;
      else pendingAges[3].count += 1;
    }

    const statusCounts = new Map<string, number>();
    for (const status of STATUS_FUNNEL_ORDER) {
      statusCounts.set(status, 0);
    }
    for (const claim of pipelineClaims) {
      statusCounts.set(
        claim.status as string,
        (statusCounts.get(claim.status as string) ?? 0) + 1,
      );
    }
    const funnel: VerificationFunnelStepDTO[] = STATUS_FUNNEL_ORDER.map(
      (status) => ({
        status,
        label: STATUS_LABELS[status] ?? status,
        count: statusCounts.get(status) ?? 0,
      }),
    );

    const actionMixMap = new Map<string, number>();
    for (const action of claimActions) {
      actionMixMap.set(
        action.action_type,
        (actionMixMap.get(action.action_type) ?? 0) + 1,
      );
    }
    const actionMix: ActionMixItemDTO[] = [...actionMixMap.entries()]
      .map(([actionType, count]) => ({
        actionType,
        label: ACTION_TYPE_LABELS[actionType] ?? actionType,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const weekStarts = buildHeatmapWeekStarts(now);
    const actionsByWeekMap = new Map<string, number>();
    for (const ws of weekStarts) {
      actionsByWeekMap.set(ws, 0);
    }
    for (const action of claimActions) {
      const key = action.acted_at.slice(0, 10);
      const weekKey = weekKeyForDate(key, now);
      if (weekKey && actionsByWeekMap.has(weekKey)) {
        actionsByWeekMap.set(
          weekKey,
          (actionsByWeekMap.get(weekKey) ?? 0) + 1,
        );
      }
    }
    const actionsByWeek: WeeklyActionCountDTO[] = weekStarts.map((ws) => ({
      weekStart: ws,
      weekLabel: format(parseISO(ws), "MMM d"),
      count: actionsByWeekMap.get(ws) ?? 0,
    }));

    const disputeCountByTutor = new Map<string, number>();
    const disputeCountByModule = new Map<string, number>();
    for (const d of disputes) {
      const cid = d.claim_id as string;
      const tid = claimIdToTutor.get(cid);
      const mid = claimIdToModule.get(cid);
      if (tid) {
        disputeCountByTutor.set(tid, (disputeCountByTutor.get(tid) ?? 0) + 1);
      }
      if (mid) {
        disputeCountByModule.set(mid, (disputeCountByModule.get(mid) ?? 0) + 1);
      }
    }

    const claimsByTutor = new Map<string, ClaimRow[]>();
    const claimsByModule = new Map<string, ClaimRow[]>();
    for (const claim of claims) {
      const tList = claimsByTutor.get(claim.tutor_id) ?? [];
      tList.push(claim);
      claimsByTutor.set(claim.tutor_id, tList);

      const mList = claimsByModule.get(claim.module_id) ?? [];
      mList.push(claim);
      claimsByModule.set(claim.module_id, mList);
    }

    const tutors: AdminTutorAnalyticsRowDTO[] = [...claimsByTutor.entries()]
      .map(([tutorId, tutorClaims]) => {
        const stats = computeTutorStats(tutorClaims as ClaimStatsRow[]);
        const rates = tutorClaims
          .map(claimAttendanceRate)
          .filter((r): r is number => r != null);
        const consistency =
          rates.length > 0 ? attendanceConsistencyScore(rates) : null;

        const tutorTurnaround: number[] = [];
        let submissionsInPeriod = 0;
        for (const c of tutorClaims) {
          if (c.submitted_at) submissionsInPeriod += 1;
          if (!c.submitted_at) continue;
          const approvedAt = firstApproveAt.get(c.id);
          if (approvedAt) {
            tutorTurnaround.push(turnaroundHours(c.submitted_at, approvedAt));
          }
        }

        const nonDraft = tutorClaims.filter((c) => c.status !== "DRAFT").length;
        const disputeCount = disputeCountByTutor.get(tutorId) ?? 0;
        const disputeRate = nonDraft > 0 ? disputeCount / nonDraft : null;
        const approvalRate = stats.approvalRate;
        const attendanceAverage = stats.attendanceAverage;

        return {
          tutorId,
          fullName: tutorNameById.get(tutorId) ?? "Tutor",
          sessionsCompleted: stats.sessionsCompleted,
          approvalRate,
          medianTurnaroundHours: median(tutorTurnaround),
          attendanceAverage,
          attendanceConsistency: consistency,
          disputeCount,
          disputeRate,
          pendingClaims: stats.pendingClaims,
          totalHours: stats.totalHours,
          performanceScore: computePerformanceScore({
            approvalRate,
            attendanceAverage,
            attendanceConsistency: consistency,
            disputeRate,
          }),
          lastLoginAt: tutorLoginById.get(tutorId) ?? null,
          submissionsInPeriod,
        };
      })
      .sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0));

    const scheduledByModule = new Map<string, number>();
    const completedByModule = new Map<string, number>();
    for (const s of scheduledRes.data ?? []) {
      const mid = s.module_id as string;
      scheduledByModule.set(mid, (scheduledByModule.get(mid) ?? 0) + 1);
    }
    for (const c of claims) {
      if (
        !c.source_scheduled_session_id ||
        !scheduledIds.has(c.source_scheduled_session_id) ||
        c.status === "DRAFT"
      ) {
        continue;
      }
      completedByModule.set(
        c.module_id,
        (completedByModule.get(c.module_id) ?? 0) + 1,
      );
    }

    const modulesAnalytics: ModuleAnalyticsRowDTO[] = moduleRows.map((mod) => {
      const modClaims = claimsByModule.get(mod.id) ?? [];
      const nonDraft = modClaims.filter((c) => c.status !== "DRAFT");
      const sessionCount = nonDraft.length;

      let presentSum = 0;
      let expectedSum = 0;
      let pendingCount = 0;
      let rejectedCount = 0;

      for (const c of modClaims) {
        if (c.status === "PENDING_VERIFICATION") pendingCount += 1;
        if (c.status === "REJECTED") rejectedCount += 1;
        const p = c.attendance_present_count;
        const e = c.attendance_expected_count;
        if (p != null && e != null && e > 0 && c.status !== "DRAFT") {
          presentSum += p;
          expectedSum += e;
        }
      }

      const modAverageAttendanceRate =
        expectedSum > 0
          ? Math.round((presentSum / expectedSum) * 100) / 100
          : null;

      const expectedScheduled = scheduledByModule.get(mod.id) ?? 0;
      const completedScheduled = completedByModule.get(mod.id) ?? 0;
      const completionRate =
        expectedScheduled > 0
          ? completedScheduled / expectedScheduled
          : null;

      const disputeCount = disputeCountByModule.get(mod.id) ?? 0;
      const rejectionRate =
        sessionCount > 0 ? rejectedCount / sessionCount : null;
      const disputeRate = sessionCount > 0 ? disputeCount / sessionCount : null;

      const isHighRisk =
        (modAverageAttendanceRate != null &&
          modAverageAttendanceRate < HIGH_RISK_ATTENDANCE_THRESHOLD) ||
        pendingCount >= HIGH_RISK_PENDING_COUNT ||
        (disputeRate != null && disputeRate >= HIGH_RISK_DISPUTE_RATE);

      return {
        moduleId: mod.id,
        moduleCode: mod.code,
        moduleName: mod.name,
        sessionCount,
        averageAttendanceRate: modAverageAttendanceRate,
        completionRate,
        pendingCount,
        rejectionRate,
        disputeCount,
        isHighRisk,
      };
    });

    const heatAgg = new Map<
      string,
      { present: number; expected: number; sessions: number }
    >();
    for (const mod of moduleRows) {
      for (const ws of weekStarts) {
        heatAgg.set(`${mod.id}:${ws}`, {
          present: 0,
          expected: 0,
          sessions: 0,
        });
      }
    }
    for (const claim of claims) {
      const wk = weekKeyForDate(claim.session_date, now);
      if (!wk) continue;
      const p = claim.attendance_present_count;
      const e = claim.attendance_expected_count;
      if (p == null || e == null || e <= 0 || claim.status === "DRAFT") {
        continue;
      }
      const key = `${claim.module_id}:${wk}`;
      const agg = heatAgg.get(key);
      if (!agg) continue;
      agg.present += p;
      agg.expected += e;
      agg.sessions += 1;
    }

    const moduleHeatMap: ModuleHeatCellDTO[] = [];
    for (const mod of moduleRows) {
      for (const ws of weekStarts) {
        const agg = heatAgg.get(`${mod.id}:${ws}`);
        const value =
          agg && agg.expected > 0
            ? Math.round((agg.present / agg.expected) * 100)
            : null;
        moduleHeatMap.push({
          moduleId: mod.id,
          moduleCode: mod.code,
          weekStart: ws,
          weekLabel: format(parseISO(ws), "MMM d"),
          value,
        });
      }
    }

    const workloadDistribution: WorkloadBarDTO[] = tutors
      .map((t) => ({
        tutorId: t.tutorId,
        tutorName: t.fullName,
        hours: Math.round(t.totalHours * 10) / 10,
        verificationActions: t.submissionsInPeriod,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 12);

    const modulesByLecturer = new Map<string, string[]>();
    for (const mod of moduleRows) {
      const list = modulesByLecturer.get(mod.lecturerId) ?? [];
      list.push(mod.id);
      modulesByLecturer.set(mod.lecturerId, list);
    }

    const lecturers: LecturerAnalyticsRowDTO[] = lecturerIds.map(
      (lecturerId) => {
        const modIds = modulesByLecturer.get(lecturerId) ?? [];
        const lecClaims = claims.filter((c) => modIds.includes(c.module_id));
        let pendingVerificationCount = 0;
        const verifyHours: number[] = [];
        let verificationActionsCount = 0;

        for (const c of lecClaims) {
          if (c.status === "PENDING_VERIFICATION") {
            pendingVerificationCount += 1;
          }
          if (c.submitted_at) {
            const verified = verifiedAt.get(c.id);
            if (verified) {
              verifyHours.push(turnaroundHours(c.submitted_at, verified));
            }
          }
        }

        for (const action of claimActions) {
          if (action.actor_id === lecturerId) {
            verificationActionsCount += 1;
          }
        }

        return {
          lecturerId,
          fullName: lecturerNameById.get(lecturerId) ?? "Lecturer",
          moduleCount: modIds.length,
          pendingVerificationCount,
          medianVerifyHours: median(verifyHours),
          verificationActionsCount,
        };
      },
    );

    const termRows = termsRes.data ?? [];
    const termLabelById = new Map(
      termRows.map((t) => [
        t.id as string,
        `${t.label as string} (${t.academic_year as string})`,
      ]),
    );

    const claimsByTerm = new Map<string, ClaimRow[]>();
    const scheduledByTerm = new Map<string, number>();
    const completedByTerm = new Map<string, number>();

    for (const claim of claims) {
      const termId = moduleIdToTerm.get(claim.module_id) ?? "unassigned";
      const list = claimsByTerm.get(termId) ?? [];
      list.push(claim);
      claimsByTerm.set(termId, list);
    }

    for (const s of scheduledRes.data ?? []) {
      const termId = moduleIdToTerm.get(s.module_id as string) ?? "unassigned";
      scheduledByTerm.set(termId, (scheduledByTerm.get(termId) ?? 0) + 1);
    }
    for (const c of claims) {
      if (
        !c.source_scheduled_session_id ||
        !scheduledIds.has(c.source_scheduled_session_id) ||
        c.status === "DRAFT"
      ) {
        continue;
      }
      const termId = moduleIdToTerm.get(c.module_id) ?? "unassigned";
      completedByTerm.set(termId, (completedByTerm.get(termId) ?? 0) + 1);
    }

    const termIds = new Set([
      ...termRows.map((t) => t.id as string),
      ...claimsByTerm.keys(),
    ]);

    const byTerm: ComparisonSliceDTO[] = [...termIds]
      .map((termId) => {
        const label =
          termId === "unassigned"
            ? "Unassigned term"
            : (termLabelById.get(termId) ?? termId);
        return buildComparisonSlice(
          termId,
          label,
          claimsByTerm.get(termId) ?? [],
          scheduledByTerm.get(termId) ?? 0,
          completedByTerm.get(termId) ?? 0,
        );
      })
      .filter((s) => s.sessionCount > 0 || s.pendingCount > 0)
      .sort((a, b) => b.sessionCount - a.sessionCount);

    const venueIds = [
      ...new Set(
        (scheduledRes.data ?? [])
          .map((s) => s.venue_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const venueCampusMap = new Map<string, string | null>();
    if (venueIds.length) {
      const { data: venues, error: vErr } = await supabase
        .from("venues")
        .select("id, campus_id")
        .in("id", venueIds);
      if (vErr) throw new Error(vErr.message);
      for (const v of venues ?? []) {
        venueCampusMap.set(v.id as string, v.campus_id as string | null);
      }
    }

    const campusRows = campusesRes.data ?? [];
    const campusLabelById = new Map(
      campusRows.map((c) => [
        c.id as string,
        (c.name as string) || (c.code as string) || "Campus",
      ]),
    );

    const scheduledByCampus = new Map<string, number>();
    const completedByCampus = new Map<string, number>();
    const claimsByCampus = new Map<string, ClaimRow[]>();

    for (const s of scheduledRes.data ?? []) {
      const campusId =
        (s.venue_id && venueCampusMap.get(s.venue_id as string)) ||
        "unassigned";
      scheduledByCampus.set(
        campusId,
        (scheduledByCampus.get(campusId) ?? 0) + 1,
      );
    }

    for (const claim of claims) {
      const campusId = "unassigned";
      if (claim.source_scheduled_session_id) {
        const session = (scheduledRes.data ?? []).find(
          (s) => s.id === claim.source_scheduled_session_id,
        );
        if (session?.venue_id) {
          const cid =
            venueCampusMap.get(session.venue_id as string) ?? "unassigned";
          const list = claimsByCampus.get(cid) ?? [];
          list.push(claim);
          claimsByCampus.set(cid, list);
          if (
            claim.source_scheduled_session_id &&
            scheduledIds.has(claim.source_scheduled_session_id) &&
            claim.status !== "DRAFT"
          ) {
            completedByCampus.set(cid, (completedByCampus.get(cid) ?? 0) + 1);
          }
          continue;
        }
      }
      const list = claimsByCampus.get(campusId) ?? [];
      list.push(claim);
      claimsByCampus.set(campusId, list);
    }

    const campusIds = new Set([
      ...campusRows.map((c) => c.id as string),
      ...claimsByCampus.keys(),
    ]);

    const byCampus: ComparisonSliceDTO[] = [...campusIds]
      .map((campusId) => {
        const label =
          campusId === "unassigned"
            ? "No campus"
            : (campusLabelById.get(campusId) ?? campusId);
        return buildComparisonSlice(
          campusId,
          label,
          claimsByCampus.get(campusId) ?? [],
          scheduledByCampus.get(campusId) ?? 0,
          completedByCampus.get(campusId) ?? 0,
        );
      })
      .filter((s) => s.sessionCount > 0 || s.pendingCount > 0)
      .sort((a, b) => b.sessionCount - a.sessionCount);

    let activeTutors = 0;
    const tutorRows = tutorUsersRes.data ?? [];
    if (tutorRows.length) {
      const { data: allTutorClaims, error: atcErr } = await supabase
        .from("session_claims")
        .select(
          "id, tutor_id, status, submitted_at, attendance_present_count, attendance_expected_count, hours, session_date, updated_at, source_scheduled_session_id",
        )
        .in("module_id", moduleIds)
        .in(
          "tutor_id",
          tutorRows.map((t) => t.id as string),
        );
      if (atcErr) throw new Error(atcErr.message);

      const claimsByTutorAll = new Map<string, ClaimStatsRow[]>();
      for (const row of allTutorClaims ?? []) {
        const tid = row.tutor_id as string;
        const list = claimsByTutorAll.get(tid) ?? [];
        list.push(row as ClaimStatsRow);
        claimsByTutorAll.set(tid, list);
      }

      for (const tutor of tutorRows) {
        const tid = tutor.id as string;
        const stats = computeTutorStats(claimsByTutorAll.get(tid) ?? []);
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

    const onboardingRows = (onboardingRes.data ?? []) as {
      user_status: string;
      onboarding_step: string | null;
      role: string;
    }[];

    return {
      institutionName: (institution?.name as string | null) ?? null,
      lookbackDays: ANALYTICS_LOOKBACK_DAYS,
      kpis: {
        pendingVerificationCount,
        medianTurnaroundHours: median(turnaroundHoursList),
        averageAttendanceRate,
        openDisputes,
        scheduleCompletionRate:
          scheduleCompletionRate != null
            ? Math.round(scheduleCompletionRate * 100) / 100
            : null,
        pendingAdminApprovals,
        activeScheduledSessions: weekScheduledRes.count ?? 0,
      },
      attendanceTrend,
      claimsVolumeTrend,
      tutors,
      modules: modulesAnalytics.sort((a, b) =>
        a.isHighRisk === b.isHighRisk ? 0 : a.isHighRisk ? -1 : 1,
      ),
      moduleHeatMap,
      lecturers: lecturers.sort(
        (a, b) => b.pendingVerificationCount - a.pendingVerificationCount,
      ),
      workflow: {
        funnel,
        pendingAges,
        actionsByWeek,
        actionMix,
        verificationActionsTotal: claimActions.length,
        stageTimings,
        pendingAdminApprovals,
        disputeCountInPeriod,
      },
      workloadDistribution,
      onboarding: {
        tutors: mapOnboardingCounts(onboardingRows, "TUTOR"),
        lecturers: mapOnboardingCounts(onboardingRows, "LECTURER"),
      },
      comparisons: { byTerm, byCampus },
      institution: {
        activeScheduledSessions: weekScheduledRes.count ?? 0,
        utilizationRate:
          scheduleCompletionRate != null
            ? Math.round(scheduleCompletionRate * 100) / 100
            : null,
        totalModules: moduleRows.length,
        activeTutors,
      },
    };
  },
);
