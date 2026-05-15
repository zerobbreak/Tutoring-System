import type { AttendanceTrendPointDTO } from "#/server-actions/lecturer-attendance";

export type AnalyticsKpisDTO = {
  pendingVerificationCount: number;
  medianTurnaroundHours: number | null;
  averageAttendanceRate: number | null;
  openDisputes: number;
  scheduleCompletionRate: number | null;
};

export type TutorAnalyticsRowDTO = {
  tutorId: string;
  fullName: string;
  sessionsCompleted: number;
  approvalRate: number | null;
  medianTurnaroundHours: number | null;
  attendanceAverage: number | null;
  attendanceConsistency: number | null;
  disputeCount: number;
  disputeRate: number | null;
  pendingClaims: number;
  totalHours: number;
  performanceScore: number | null;
};

export type ModuleAnalyticsRowDTO = {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  sessionCount: number;
  averageAttendanceRate: number | null;
  completionRate: number | null;
  pendingCount: number;
  rejectionRate: number | null;
  disputeCount: number;
  isHighRisk: boolean;
};

export type VerificationFunnelStepDTO = {
  status: string;
  label: string;
  count: number;
};

export type PendingAgeBucketDTO = {
  bucket: string;
  label: string;
  count: number;
};

export type WeeklyActionCountDTO = {
  weekStart: string;
  weekLabel: string;
  count: number;
};

export type ActionMixItemDTO = {
  actionType: string;
  label: string;
  count: number;
};

export type ModuleHeatCellDTO = {
  moduleId: string;
  moduleCode: string;
  weekStart: string;
  weekLabel: string;
  value: number | null;
};

export type WorkloadBarDTO = {
  tutorId: string;
  tutorName: string;
  hours: number;
  verificationActions: number;
};

export type ClaimsVolumePointDTO = {
  date: string;
  dateLabel: string;
  submitted: number;
  completed: number;
};

export type WorkflowAnalyticsDTO = {
  funnel: VerificationFunnelStepDTO[];
  pendingAges: PendingAgeBucketDTO[];
  actionsByWeek: WeeklyActionCountDTO[];
  actionMix: ActionMixItemDTO[];
  lecturerActionsTotal: number;
};

export type LecturerAnalyticsDTO = {
  lookbackDays: number;
  kpis: AnalyticsKpisDTO;
  attendanceTrend: AttendanceTrendPointDTO[];
  claimsVolumeTrend: ClaimsVolumePointDTO[];
  tutors: TutorAnalyticsRowDTO[];
  modules: ModuleAnalyticsRowDTO[];
  workflow: WorkflowAnalyticsDTO;
  moduleHeatMap: ModuleHeatCellDTO[];
  workloadDistribution: WorkloadBarDTO[];
};
