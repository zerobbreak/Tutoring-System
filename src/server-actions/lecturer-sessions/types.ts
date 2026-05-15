import type { ClaimStatus } from "#/lib/session-claim-display";
import type { LecturerSessionTimeBucket } from "#/lib/lecturer-session-bucket";

export type LecturerSessionCardDTO = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  venue: string | null;
  status: ClaimStatus;
  submitted_at: string | null;
  updated_at: string;
  session_kind: string | null;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  attendance_scan_count: number;
  evidence_count: number;
  time_bucket: LecturerSessionTimeBucket;
  missing_evidence: boolean;
  low_attendance: boolean;
  completion_verified: boolean;
  linked_from_schedule: boolean;
  module: { id: string; code: string; name: string } | null;
  tutor: { id: string; full_name: string; email: string } | null;
};

export type LecturerSessionsPageDataDTO = {
  today: LecturerSessionCardDTO[];
  upcoming: LecturerSessionCardDTO[];
  completed: LecturerSessionCardDTO[];
  cancelledSchedule: CancelledScheduleRowDTO[];
  rejectedClaims: LecturerSessionCardDTO[];
};

export type CancelledScheduleRowDTO = {
  id: string;
  starts_at: string;
  ends_at: string;
  venue_text: string | null;
  title: string;
  module_code: string;
  module_name: string;
  tutor_name: string;
  linked_claim_id: string | null;
};

export type SessionAttendanceRowDTO = {
  id: string;
  status: string;
  check_in_time: string | null;
  is_verified: boolean;
  notes: string | null;
  student: {
    full_name: string;
    email: string | null;
    student_reference: string | null;
  } | null;
};

export type LecturerSessionDetailDTO = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  venue: string | null;
  status: ClaimStatus;
  submitted_at: string | null;
  session_kind: string | null;
  notes: string | null;
  topics_covered: string | null;
  examples_used: string | null;
  student_struggles: string | null;
  revision_topics: string | null;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  attendance_scan_count: number;
  evidence_count: number;
  missing_evidence: boolean;
  completion_verified: boolean;
  session_ended: boolean;
  linked_from_schedule: boolean;
  linked_from_lecturer_schedule: boolean;
  qr_token: string | null;
  qr_expires_at: string | null;
  qr_check_in_url: string | null;
  module: { id: string; code: string; name: string } | null;
  tutor: { id: string; full_name: string; email: string } | null;
  evidence: {
    id: string;
    file_name: string;
    file_url: string;
    uploaded_at: string;
  }[];
  attendance_rows: SessionAttendanceRowDTO[];
  attendance_by_status: Record<string, number>;
  timeline: {
    id: string;
    action_type: string;
    from_status: ClaimStatus | null;
    to_status: ClaimStatus | null;
    comment: string | null;
    acted_at: string;
    actor_name: string | null;
  }[];
  headcount_matches_scans: boolean | null;
  can_verify: boolean;
};
