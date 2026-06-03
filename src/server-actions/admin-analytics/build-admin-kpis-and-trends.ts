import { buildTrendSeries } from "#/server-actions/lecturer-attendance/build-trend-series";
import { ANALYTICS_LOOKBACK_DAYS } from "#/server-actions/lecturer-analytics/constants";
import {
  buildClaimsVolumeTrend,
  claimAttendanceRate,
  median,
  turnaroundHours,
} from "#/server-actions/lecturer-analytics/helpers";
import type { AdminAnalyticsBuildContext } from "./admin-analytics-context";
import type { AdminAnalyticsKpisDTO } from "./types";
import type { AttendanceTrendPointDTO } from "#/server-actions/lecturer-attendance";
import type { ClaimsVolumePointDTO } from "#/server-actions/lecturer-analytics/types";

export function buildAdminKpisAndTrends(ctx: AdminAnalyticsBuildContext): {
  kpis: AdminAnalyticsKpisDTO;
  attendanceTrend: AttendanceTrendPointDTO[];
  claimsVolumeTrend: ClaimsVolumePointDTO[];
} {
  const attendanceTrend = buildTrendSeries(
    ctx.claims,
    ANALYTICS_LOOKBACK_DAYS,
    ctx.now,
  );

  let totalPresent = 0;
  let totalExpected = 0;
  const claimsVolumeTrend = buildClaimsVolumeTrend(
    ctx.claims,
    ANALYTICS_LOOKBACK_DAYS,
    ctx.now,
    ctx.firstApproveAt,
  );

  const turnaroundHoursList: number[] = [];

  for (const claim of ctx.claims) {
    const rate = claimAttendanceRate(claim);
    if (rate != null) {
      totalPresent += claim.attendance_present_count!;
      totalExpected += claim.attendance_expected_count!;
    }
    if (claim.submitted_at) {
      const approvedAt = ctx.firstApproveAt.get(claim.id);
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

  const scheduleCompletionRate = ctx.scheduleCompletionRate;

  return {
    kpis: {
      pendingVerificationCount: ctx.pendingVerificationCount,
      medianTurnaroundHours: median(turnaroundHoursList),
      averageAttendanceRate,
      openDisputes: ctx.openDisputes,
      scheduleCompletionRate:
        scheduleCompletionRate != null
          ? Math.round(scheduleCompletionRate * 100) / 100
          : null,
      pendingAdminApprovals: ctx.pendingAdminApprovals,
      activeScheduledSessions: ctx.weekScheduledCount,
    },
    attendanceTrend,
    claimsVolumeTrend,
  };
}
