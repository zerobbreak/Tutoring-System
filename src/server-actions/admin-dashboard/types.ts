import type {
  LecturerActivityItemDTO,
  LecturerModuleDTO,
} from "#/server-actions/lecturer-dashboard/types";
import type { PendingTutorSessionCreationDTO } from "#/server-actions/admin-sessions/tutor-session-creations";

export type AdminPipelineDTO = {
  pendingLecturerVerifications: number;
  pendingAdminApprovals: number;
  pendingTutorSessionCreations: number;
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
  pendingTutorSessionCreations: PendingTutorSessionCreationDTO[];
  activityFeed: LecturerActivityItemDTO[];
  lecturerActivity: AdminLecturerActivityDTO[];
  deadlines: AdminDeadlineDTO[];
  analyticsSummary: AdminAnalyticsSummaryDTO;
  weekStart: string;
  weekEnd: string;
};

export type { LecturerModuleDTO };
