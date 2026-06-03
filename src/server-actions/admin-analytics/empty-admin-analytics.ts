import {
  ANALYTICS_LOOKBACK_DAYS,
  STATUS_FUNNEL_ORDER,
  STATUS_LABELS,
} from "#/server-actions/lecturer-analytics/constants";
import type { AdminAnalyticsDTO } from "./types";
import { mapOnboardingCounts } from "./workflow-stages";

export function emptyAdminAnalytics(): AdminAnalyticsDTO {
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
    onboarding: {
      tutors: mapOnboardingCounts([], "TUTOR"),
      lecturers: mapOnboardingCounts([], "LECTURER"),
    },
    comparisons: { byTerm: [], byCampus: [] },
    institution: {
      activeScheduledSessions: 0,
      utilizationRate: null,
      totalModules: 0,
      activeTutors: 0,
    },
  };
}
