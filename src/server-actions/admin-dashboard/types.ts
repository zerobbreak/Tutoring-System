import type { IntegrityIssueDTO } from "#/server-actions/lecturer-attendance/types";
import type {
  LecturerActivityItemDTO,
  LecturerAttendanceAlertDTO,
  LecturerModuleDTO,
} from "#/server-actions/lecturer-dashboard/types";

export type AdminPipelineDTO = {
  pendingLecturerVerifications: number;
  pendingAdminApprovals: number;
  openDisputes: number;
  stalledClaims: number;
  pendingScheduleChanges: number;
};

export type AdminLecturerActivityDTO = {
  id: string;
  at: string;
  actorName: string;
  actionType: string;
  moduleCode: string | null;
  message: string;
};

export type AdminDeadlineDTO = {
  id: string;
  kind: "SESSIONS_TOMORROW" | "STALLED_CLAIM" | "OPEN_DISPUTE";
  label: string;
  count?: number;
  at?: string;
};

export type AdminAnalyticsSummaryDTO = {
  totalModules: number;
  totalTutors: number;
  activeTutors: number;
  totalLecturers: number;
  claimsPending: number;
  claimsVerified: number;
  claimsApproved: number;
  openDisputes: number;
};

export type AdminDashboardDataDTO = {
  institutionName: string | null;
  pendingApprovalsCount: number;
  verifiedClaimsCount: number;
  activeSessionsCount: number;
  approvedHours: number;
  pipeline: AdminPipelineDTO;
  attendanceAlerts: LecturerAttendanceAlertDTO[];
  integrityIssues: IntegrityIssueDTO[];
  activityFeed: LecturerActivityItemDTO[];
  lecturerActivity: AdminLecturerActivityDTO[];
  deadlines: AdminDeadlineDTO[];
  analyticsSummary: AdminAnalyticsSummaryDTO;
  weekStart: string;
  weekEnd: string;
};

export type { LecturerModuleDTO };
