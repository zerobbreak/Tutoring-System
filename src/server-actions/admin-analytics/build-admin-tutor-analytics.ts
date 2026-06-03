import {
  computeTutorStats,
  type ClaimStatsRow,
} from "#/server-actions/lecturer-tutors/compute-tutor-stats";
import {
  attendanceConsistencyScore,
  claimAttendanceRate,
  computePerformanceScore,
  median,
  turnaroundHours,
} from "#/server-actions/lecturer-analytics/helpers";
import type {
  WorkloadBarDTO,
} from "#/server-actions/lecturer-analytics/types";
import type { AdminAnalyticsBuildContext } from "./admin-analytics-context";
import type { AdminTutorAnalyticsRowDTO } from "./types";

export function buildAdminTutorAnalytics(ctx: AdminAnalyticsBuildContext): {
  tutors: AdminTutorAnalyticsRowDTO[];
  workloadDistribution: WorkloadBarDTO[];
} {
  const tutors: AdminTutorAnalyticsRowDTO[] = [...ctx.claimsByTutor.entries()]
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
        const approvedAt = ctx.firstApproveAt.get(c.id);
        if (approvedAt) {
          tutorTurnaround.push(turnaroundHours(c.submitted_at, approvedAt));
        }
      }

      const nonDraft = tutorClaims.filter((c) => c.status !== "DRAFT").length;
      const disputeCount = ctx.disputeCountByTutor.get(tutorId) ?? 0;
      const disputeRate = nonDraft > 0 ? disputeCount / nonDraft : null;
      const approvalRate = stats.approvalRate;
      const attendanceAverage = stats.attendanceAverage;

      return {
        tutorId,
        fullName: ctx.tutorNameById.get(tutorId) ?? "Tutor",
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
        lastLoginAt: ctx.tutorLoginById.get(tutorId) ?? null,
        submissionsInPeriod,
      };
    })
    .sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0));

  const workloadDistribution: WorkloadBarDTO[] = tutors
    .map((t) => ({
      tutorId: t.tutorId,
      tutorName: t.fullName,
      hours: Math.round(t.totalHours * 10) / 10,
      verificationActions: t.submissionsInPeriod,
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 12);

  return { tutors, workloadDistribution };
}
