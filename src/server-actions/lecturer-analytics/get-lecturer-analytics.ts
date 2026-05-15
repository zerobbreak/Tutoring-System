import { createServerFn } from "@tanstack/react-start";
import { differenceInHours, format, parseISO, subDays } from "date-fns";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { buildTrendSeries } from "#/server-actions/lecturer-attendance/build-trend-series";
import { computeTutorStats } from "#/server-actions/lecturer-tutors/compute-tutor-stats";
import type { ClaimStatsRow } from "#/server-actions/lecturer-tutors/compute-tutor-stats";
import {
  ANALYTICS_LOOKBACK_DAYS,
  CLAIM_ANALYTICS_SELECT,
  HIGH_RISK_ATTENDANCE_THRESHOLD,
  HIGH_RISK_DISPUTE_RATE,
  HIGH_RISK_PENDING_COUNT,
  STATUS_FUNNEL_ORDER,
  STATUS_LABELS,
} from "./constants";
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
} from "./helpers";
import type {
  ActionMixItemDTO,
  LecturerAnalyticsDTO,
  ModuleAnalyticsRowDTO,
  ModuleHeatCellDTO,
  PendingAgeBucketDTO,
  TutorAnalyticsRowDTO,
  VerificationFunnelStepDTO,
  WeeklyActionCountDTO,
  WorkloadBarDTO,
} from "./types";

function emptyAnalytics(): LecturerAnalyticsDTO {
  return {
    lookbackDays: ANALYTICS_LOOKBACK_DAYS,
    kpis: {
      pendingVerificationCount: 0,
      medianTurnaroundHours: null,
      averageAttendanceRate: null,
      openDisputes: 0,
      scheduleCompletionRate: null,
    },
    attendanceTrend: [],
    claimsVolumeTrend: [],
    tutors: [],
    modules: [],
    workflow: {
      funnel: STATUS_FUNNEL_ORDER.map((status) => ({
        status,
        label: STATUS_LABELS[status] ?? status,
        count: 0,
      })),
      pendingAges: [
        { bucket: "0-1", label: "< 1 day", count: 0 },
        { bucket: "1-3", label: "1–3 days", count: 0 },
        { bucket: "3-7", label: "3–7 days", count: 0 },
        { bucket: "7+", label: "7+ days", count: 0 },
      ],
      actionsByWeek: [],
      actionMix: [],
      lecturerActionsTotal: 0,
    },
    moduleHeatMap: [],
    workloadDistribution: [],
  };
}

export const getLecturerAnalyticsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LecturerAnalyticsDTO> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    const now = new Date();
    const trendFrom = format(
      subDays(now, ANALYTICS_LOOKBACK_DAYS),
      "yyyy-MM-dd",
    );
    const scheduleFrom = subDays(now, ANALYTICS_LOOKBACK_DAYS).toISOString();

    const { data: modules, error: modErr } = await supabase
      .from("modules")
      .select("id, code, name")
      .eq("lecturer_id", lecturerId)
      .order("code", { ascending: true });

    if (modErr) throw new Error(modErr.message);

    const moduleRows = (modules ?? []).map((m) => ({
      id: m.id as string,
      code: m.code as string,
      name: m.name as string,
    }));
    const moduleIds = moduleRows.map((m) => m.id);
    if (!moduleIds.length) {
      return emptyAnalytics();
    }

    const [claimsRes, disputesRes, actionsRes, scheduledRes] =
      await Promise.all([
      supabase
        .from("session_claims")
        .select(CLAIM_ANALYTICS_SELECT)
        .in("module_id", moduleIds)
        .gte("session_date", trendFrom)
        .order("session_date", { ascending: true }),
      supabase
        .from("disputes")
        .select("id, claim_id, status, raised_at")
        .order("raised_at", { ascending: false }),
      supabase
        .from("verification_actions")
        .select("claim_id, actor_id, action_type, to_status, acted_at")
        .order("acted_at", { ascending: true }),
      supabase
        .from("scheduled_sessions")
        .select("id, module_id, status")
        .in("module_id", moduleIds)
        .neq("status", "CANCELLED")
        .gte("starts_at", scheduleFrom),
    ]);

    if (claimsRes.error) throw new Error(claimsRes.error.message);
    if (disputesRes.error) throw new Error(disputesRes.error.message);
    if (actionsRes.error) throw new Error(actionsRes.error.message);
    if (scheduledRes.error) throw new Error(scheduledRes.error.message);

    const claims = (claimsRes.data ?? []) as ClaimRow[];
    const claimIds = new Set(claims.map((c) => c.id));
    const claimIdToTutor = new Map(claims.map((c) => [c.id, c.tutor_id]));
    const claimIdToModule = new Map(claims.map((c) => [c.id, c.module_id]));

    const disputes = (disputesRes.data ?? []).filter((d) =>
      claimIds.has(d.claim_id as string),
    );
    const openDisputes = disputes.filter((d) => d.status === "OPEN").length;

    const allActions = (actionsRes.data ?? []) as VerificationActionRow[];
    const claimActions = allActions.filter((a) => claimIds.has(a.claim_id));
    const lecturerActions = claimActions.filter(
      (a) => a.actor_id === lecturerId,
    );
    const firstApproveAt = firstApproveByClaim(claimActions);

    const tutorIds = [...new Set(claims.map((c) => c.tutor_id))];
    const tutorNameById = new Map<string, string>();
    if (tutorIds.length) {
      const { data: tutorUsers, error: tutorErr } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", tutorIds);
      if (tutorErr) throw new Error(tutorErr.message);
      for (const u of tutorUsers ?? []) {
        tutorNameById.set(u.id as string, u.full_name as string);
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
    const claimsVolumeTrend = buildClaimsVolumeTrend(
      claims,
      ANALYTICS_LOOKBACK_DAYS,
      now,
      firstApproveAt,
    );

    let totalPresent = 0;
    let totalExpected = 0;
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

    const pendingClaims = claims.filter(
      (c) => c.status === "PENDING_VERIFICATION",
    );
    const pendingVerificationCount = pendingClaims.length;

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
    for (const claim of claims) {
      statusCounts.set(claim.status, (statusCounts.get(claim.status) ?? 0) + 1);
    }
    const funnel: VerificationFunnelStepDTO[] = STATUS_FUNNEL_ORDER.map(
      (status) => ({
        status,
        label: STATUS_LABELS[status] ?? status,
        count: statusCounts.get(status) ?? 0,
      }),
    );

    const actionMixMap = new Map<string, number>();
    for (const action of lecturerActions) {
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
    for (const action of lecturerActions) {
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

    const lecturerActionsByTutor = new Map<string, number>();
    for (const action of lecturerActions) {
      const tid = claimIdToTutor.get(action.claim_id);
      if (!tid) continue;
      lecturerActionsByTutor.set(
        tid,
        (lecturerActionsByTutor.get(tid) ?? 0) + 1,
      );
    }

    const tutors: TutorAnalyticsRowDTO[] = [...claimsByTutor.entries()]
      .map(([tutorId, tutorClaims]) => {
        const stats = computeTutorStats(tutorClaims as ClaimStatsRow[]);
        const rates = tutorClaims
          .map(claimAttendanceRate)
          .filter((r): r is number => r != null);
        const consistency =
          rates.length > 0 ? attendanceConsistencyScore(rates) : null;

        const tutorTurnaround: number[] = [];
        for (const c of tutorClaims) {
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
        const attendanceConsistency = consistency;

        return {
          tutorId,
          fullName: tutorNameById.get(tutorId) ?? "Tutor",
          sessionsCompleted: stats.sessionsCompleted,
          approvalRate,
          medianTurnaroundHours: median(tutorTurnaround),
          attendanceAverage,
          attendanceConsistency,
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

      const averageAttendanceRate =
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
        (averageAttendanceRate != null &&
          averageAttendanceRate < HIGH_RISK_ATTENDANCE_THRESHOLD) ||
        pendingCount >= HIGH_RISK_PENDING_COUNT ||
        (disputeRate != null && disputeRate >= HIGH_RISK_DISPUTE_RATE);

      return {
        moduleId: mod.id,
        moduleCode: mod.code,
        moduleName: mod.name,
        sessionCount,
        averageAttendanceRate,
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
        verificationActions: lecturerActionsByTutor.get(t.tutorId) ?? 0,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 12);

    return {
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
      },
      attendanceTrend,
      claimsVolumeTrend,
      tutors,
      modules: modulesAnalytics.sort((a, b) =>
        a.isHighRisk === b.isHighRisk ? 0 : a.isHighRisk ? -1 : 1,
      ),
      workflow: {
        funnel,
        pendingAges,
        actionsByWeek,
        actionMix,
        lecturerActionsTotal: lecturerActions.length,
      },
      moduleHeatMap,
      workloadDistribution,
    };
  },
);
