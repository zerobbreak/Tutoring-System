import type { ClaimStatus } from "#/lib/session-claim-display";

export type VerificationModuleOptionDTO = {
  id: string;
  code: string;
  name: string;
};

export type VerificationTutorRefDTO = {
  full_name: string;
  email: string;
};

export type VerificationClaimCardDTO = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  venue: string | null;
  status: ClaimStatus;
  submitted_at: string | null;
  updated_at: string;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  attendance_scan_count: number;
  evidence_count: number;
  module: { id: string; code: string; name: string } | null;
  tutor: VerificationTutorRefDTO | null;
};

export type VerificationQueueDataDTO = {
  pending: VerificationClaimCardDTO[];
  disputed: VerificationClaimCardDTO[];
  recentlyVerified: VerificationClaimCardDTO[];
  modules: VerificationModuleOptionDTO[];
};

export type VerificationEvidenceDTO = {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
};

export type VerificationTimelineItemDTO = {
  id: string;
  action_type: string;
  from_status: ClaimStatus | null;
  to_status: ClaimStatus | null;
  comment: string | null;
  acted_at: string;
  digitally_signed: boolean;
  actor: { full_name: string; email: string } | null;
};

export type ScheduleComparisonDTO = {
  claim_date: string;
  claim_start: string;
  claim_end: string;
  claim_venue: string | null;
  claim_hours: number;
  linked_from_schedule: boolean;
  attendance_present: number | null;
  attendance_expected: number | null;
  attendance_scan_count: number;
  headcount_matches_scans: boolean | null;
};

export type VerificationClaimDetailDTO = VerificationClaimCardDTO & {
  notes: string | null;
  topics_covered: string | null;
  session_kind: string | null;
  evidence: VerificationEvidenceDTO[];
  timeline: VerificationTimelineItemDTO[];
  schedule_comparison: ScheduleComparisonDTO;
  open_dispute: { id: string; reason: string; raised_at: string } | null;
};

export type VerificationActionKind =
  | "APPROVE"
  | "REJECT"
  | "DISPUTE"
  | "REQUEST_CLARIFICATION"
  | "SIGN_AND_APPROVE";
