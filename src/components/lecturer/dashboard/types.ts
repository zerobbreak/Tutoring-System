import type {
  LecturerActivityItemDTO,
  LecturerAttendanceAlertDTO,
  LecturerClaimDTO,
  LecturerModuleDTO,
  LecturerPendingClaimDTO,
} from "#/server-actions/lecturer-dashboard";

export type LecturerDashboardViewProps = {
  user: {
    email?: string;
    user_metadata?: Record<string, string | undefined>;
  };
  booting: boolean;
  loadError: string | null;
  onRetryLoad?: () => void;
  retryingLoad?: boolean;
  modulesCount: number;
  pendingVerificationCount: number;
  sessionsThisWeek: number;
  hoursThisWeek: number;
  modules: LecturerModuleDTO[];
  pendingClaims: LecturerPendingClaimDTO[];
  recentClaims: LecturerClaimDTO[];
  attendanceAlerts: LecturerAttendanceAlertDTO[];
  activityFeed: LecturerActivityItemDTO[];
  weekStart: string;
  weekEnd: string;
};
