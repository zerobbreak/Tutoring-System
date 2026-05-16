import type { AttendanceTrendPointDTO } from "#/server-actions/lecturer-attendance";
import type {
  ActionMixItemDTO,
  AnalyticsKpisDTO,
  ClaimsVolumePointDTO,
  ModuleAnalyticsRowDTO,
  ModuleHeatCellDTO,
  PendingAgeBucketDTO,
  TutorAnalyticsRowDTO,
  VerificationFunnelStepDTO,
  WeeklyActionCountDTO,
  WorkloadBarDTO,
} from "#/server-actions/lecturer-analytics/types";

export type WorkflowStageTimingDTO = {
  stage: string;
  label: string;
  medianHours: number | null;
};

export type AdminWorkflowAnalyticsDTO = {
  funnel: VerificationFunnelStepDTO[];
  pendingAges: PendingAgeBucketDTO[];
  actionsByWeek: WeeklyActionCountDTO[];
  actionMix: ActionMixItemDTO[];
  verificationActionsTotal: number;
  stageTimings: WorkflowStageTimingDTO[];
  pendingAdminApprovals: number;
  disputeCountInPeriod: number;
};

export type AdminTutorAnalyticsRowDTO = TutorAnalyticsRowDTO & {
  lastLoginAt: string | null;
  submissionsInPeriod: number;
};

export type LecturerAnalyticsRowDTO = {
  lecturerId: string;
  fullName: string;
  moduleCount: number;
  pendingVerificationCount: number;
  medianVerifyHours: number | null;
  verificationActionsCount: number;
  averageAttendanceRate: number | null;
};

export type OnboardingStatusCountDTO = {
  status: string;
  label: string;
  count: number;
};

export type OnboardingAnalyticsDTO = {
  tutors: OnboardingStatusCountDTO[];
  lecturers: OnboardingStatusCountDTO[];
};

export type ComparisonSliceDTO = {
  id: string;
  label: string;
  sessionCount: number;
  averageAttendanceRate: number | null;
  utilizationRate: number | null;
  pendingCount: number;
};

export type InstitutionComparisonsDTO = {
  byTerm: ComparisonSliceDTO[];
  byCampus: ComparisonSliceDTO[];
};

export type InstitutionSnapshotDTO = {
  activeScheduledSessions: number;
  utilizationRate: number | null;
  averageAttendanceRate: number | null;
  totalModules: number;
  activeTutors: number;
};

export type AdminAnalyticsKpisDTO = AnalyticsKpisDTO & {
  pendingAdminApprovals: number;
  activeScheduledSessions: number;
};

export type AdminAnalyticsDTO = {
  institutionName: string | null;
  lookbackDays: number;
  kpis: AdminAnalyticsKpisDTO;
  attendanceTrend: AttendanceTrendPointDTO[];
  claimsVolumeTrend: ClaimsVolumePointDTO[];
  tutors: AdminTutorAnalyticsRowDTO[];
  modules: ModuleAnalyticsRowDTO[];
  lecturers: LecturerAnalyticsRowDTO[];
  workflow: AdminWorkflowAnalyticsDTO;
  moduleHeatMap: ModuleHeatCellDTO[];
  workloadDistribution: WorkloadBarDTO[];
  onboarding: OnboardingAnalyticsDTO;
  comparisons: InstitutionComparisonsDTO;
  institution: InstitutionSnapshotDTO;
};
