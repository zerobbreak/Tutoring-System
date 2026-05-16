import type { AdminDashboardDataDTO } from "./types";

export function emptyAdminDashboard(
  weekStart: string,
  weekEnd: string,
): AdminDashboardDataDTO {
  return {
    institutionName: null,
    pendingApprovalsCount: 0,
    verifiedClaimsCount: 0,
    activeSessionsCount: 0,
    approvedHours: 0,
    pipeline: {
      pendingLecturerVerifications: 0,
      pendingAdminApprovals: 0,
      openDisputes: 0,
      stalledClaims: 0,
      pendingScheduleChanges: 0,
    },
    attendanceAlerts: [],
    integrityIssues: [],
    activityFeed: [],
    lecturerActivity: [],
    deadlines: [],
    analyticsSummary: {
      totalModules: 0,
      totalTutors: 0,
      activeTutors: 0,
      totalLecturers: 0,
      claimsPending: 0,
      claimsVerified: 0,
      claimsApproved: 0,
      openDisputes: 0,
    },
    weekStart,
    weekEnd,
  };
}
