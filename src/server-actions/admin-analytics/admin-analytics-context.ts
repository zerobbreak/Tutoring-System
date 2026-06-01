import type { createSupabaseServerClient } from "#/lib/supabase-server";
import type {
  ClaimRow,
  VerificationActionRow,
} from "#/server-actions/lecturer-analytics/helpers";
import type { WorkflowStageTimingDTO } from "./types";

export type AdminModuleRow = {
  id: string;
  code: string;
  name: string;
  lecturerId: string;
  academicTermId: string | null;
};

export type PipelineClaimRow = {
  id: string;
  status: string;
  submitted_at: string | null;
  module_id: string;
  tutor_id: string;
};

export type ScheduledSessionRow = {
  id: string;
  module_id: string;
  status: string;
  venue_id: string | null;
};

export type TermRow = {
  id: string;
  label: string;
  academic_year: string;
};

export type CampusRow = {
  id: string;
  name: string;
  code: string;
};

export type OnboardingRow = {
  user_status: string;
  onboarding_step: string | null;
  role: string;
};

export type TutorUserRow = {
  id: string;
  full_name: string;
  last_login_at: string | null;
  is_active: boolean;
};

export type AdminAnalyticsBuildContext = {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  institutionId: string;
  now: Date;
  institutionName: string | null;
  moduleRows: AdminModuleRow[];
  moduleIds: string[];
  moduleIdToTerm: Map<string, string | null>;
  lecturerIds: string[];
  claims: ClaimRow[];
  pipelineClaims: PipelineClaimRow[];
  institutionClaimIds: Set<string>;
  claimIdToModule: Map<string, string>;
  claimIdToTutor: Map<string, string>;
  disputes: Array<{
    id: string;
    claim_id: string;
    status: string;
    raised_at: string;
  }>;
  openDisputes: number;
  disputeCountInPeriod: number;
  claimActions: VerificationActionRow[];
  firstApproveAt: Map<string, string>;
  verifiedAt: Map<string, string>;
  adminApprovedAt: Map<string, string>;
  submittedByClaim: Map<string, string | null>;
  stageTimings: WorkflowStageTimingDTO[];
  tutorNameById: Map<string, string>;
  tutorLoginById: Map<string, string | null>;
  lecturerNameById: Map<string, string>;
  scheduledSessions: ScheduledSessionRow[];
  scheduledExpected: number;
  scheduledIds: Set<string>;
  scheduledCompleted: number;
  scheduleCompletionRate: number | null;
  pendingVerificationCount: number;
  pendingAdminApprovals: number;
  weekScheduledCount: number;
  disputeCountByTutor: Map<string, number>;
  disputeCountByModule: Map<string, number>;
  claimsByTutor: Map<string, ClaimRow[]>;
  claimsByModule: Map<string, ClaimRow[]>;
  scheduledByModule: Map<string, number>;
  completedByModule: Map<string, number>;
  weekStarts: string[];
  termRows: TermRow[];
  campusRows: CampusRow[];
  onboardingRows: OnboardingRow[];
  tutorUsers: TutorUserRow[];
};

export type AdminAnalyticsLoadResult =
  | { kind: "empty"; institutionName: string | null }
  | { kind: "loaded"; ctx: AdminAnalyticsBuildContext };
