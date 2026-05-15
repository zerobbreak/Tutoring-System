import type { LecturerDashboardDataDTO } from "./types";

export function emptyDashboard(
  weekStart: string,
  weekEnd: string,
): LecturerDashboardDataDTO {
  return {
    modulesCount: 0,
    pendingVerificationCount: 0,
    sessionsThisWeek: 0,
    hoursThisWeek: 0,
    modules: [],
    pendingClaims: [],
    recentClaims: [],
    attendanceAlerts: [],
    activityFeed: [],
    weekStart,
    weekEnd,
  };
}
