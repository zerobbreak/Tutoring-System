import type { ClaimStatus } from "#/lib/session-kanban-column";
import type { WorkflowTimelineEntry } from "#/lib/claim-workflow-timeline";
import type { CheckInSessionPreview } from "#/server-actions/tutor-sessions/student-roster";

export type { CheckInSessionPreview };

export type TutorSessionClaimDTO = {
  id: string;
  module_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  venue: string | null;
  status: ClaimStatus;
  notes: string | null;
  topics_covered: string | null;
  coverage_validated_at: string | null;
  submitted_at: string | null;
  session_kind: string | null;
  request_status: string | null;
  request_reason: string | null;
  review_feedback: string | null;
  scheduled_session_id?: string | null;
  scheduled_starts_at?: string;
  scheduled_ends_at?: string;
  creation_source?: string | null;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  attendance_locked_at: string | null;
  qr_token: string | null;
  qr_expires_at: string | null;
  module: {
    id: string;
    code: string;
    name: string;
    lecturer_id: string;
    lecturer: {
      id: string;
      full_name: string;
      email: string;
    } | null;
  } | null;
  evidenceCount: number;
};

export type VerificationActionDTO = {
  id: string;
  claim_id: string;
  actor_id: string;
  actor: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  action_type: string;
  from_status: ClaimStatus | null;
  to_status: ClaimStatus | null;
  comment: string | null;
  acted_at: string;
};

export type ClaimEvidenceDTO = {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
};

export type AttendanceRecordDTO = {
  id: string;
  student_id: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
  check_in_time: string | null;
  is_verified: boolean;
  notes: string | null;
  student: {
    full_name: string;
    email: string | null;
    student_reference: string | null;
  };
};

export type ClaimDetailsDTO = TutorSessionClaimDTO & {
  evidence: ClaimEvidenceDTO[];
  attendance_records: AttendanceRecordDTO[];
  history: WorkflowTimelineEntry[];
};

export type AttendanceEvidenceRow = {
  id: string;
  file_url: string;
  file_type: string;
  original_filename: string;
  file_size_bytes: number | null;
  uploaded_at: string | null;
  signedUrl: string | null;
};

export type TutorModuleOption = {
  moduleId: string;
  code: string;
  name: string;
};

export type ScanStudentForSessionResult = {
  success: true;
  studentId: string;
  studentName: string;
  registered: boolean;
  alreadyPresent: boolean;
};
