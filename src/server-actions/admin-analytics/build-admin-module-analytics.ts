import { format, parseISO } from "date-fns";
import {
  HIGH_RISK_ATTENDANCE_THRESHOLD,
  HIGH_RISK_DISPUTE_RATE,
  HIGH_RISK_PENDING_COUNT,
} from "#/server-actions/lecturer-analytics/constants";
import { weekKeyForDate } from "#/server-actions/lecturer-analytics/helpers";
import type {
  ModuleAnalyticsRowDTO,
  ModuleHeatCellDTO,
} from "#/server-actions/lecturer-analytics/types";
import type { AdminAnalyticsBuildContext } from "./admin-analytics-context";

export function buildAdminModuleAnalytics(ctx: AdminAnalyticsBuildContext): {
  modules: ModuleAnalyticsRowDTO[];
  moduleHeatMap: ModuleHeatCellDTO[];
} {
  const modulesAnalytics: ModuleAnalyticsRowDTO[] = ctx.moduleRows.map((mod) => {
    const modClaims = ctx.claimsByModule.get(mod.id) ?? [];
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

    const expectedScheduled = ctx.scheduledByModule.get(mod.id) ?? 0;
    const completedScheduled = ctx.completedByModule.get(mod.id) ?? 0;
    const completionRate =
      expectedScheduled > 0 ? completedScheduled / expectedScheduled : null;

    const disputeCount = ctx.disputeCountByModule.get(mod.id) ?? 0;
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
  for (const mod of ctx.moduleRows) {
    for (const ws of ctx.weekStarts) {
      heatAgg.set(`${mod.id}:${ws}`, {
        present: 0,
        expected: 0,
        sessions: 0,
      });
    }
  }
  for (const claim of ctx.claims) {
    const wk = weekKeyForDate(claim.session_date, ctx.now);
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
  for (const mod of ctx.moduleRows) {
    for (const ws of ctx.weekStarts) {
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

  return {
    modules: modulesAnalytics.sort((a, b) =>
      a.isHighRisk === b.isHighRisk ? 0 : a.isHighRisk ? -1 : 1,
    ),
    moduleHeatMap,
  };
}
