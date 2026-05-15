import type { ClaimStatus } from "#/lib/session-claim-display";

export type LecturerModuleDTO = {
  id: string;
  code: string;
  name: string;
};

export type LecturerTutorRefDTO = {
  full_name: string;
  email: string;
};

export type LecturerEvidencePreviewDTO = {
  original_filename: string;
  uploaded_at: string;
};

export type LecturerPendingClaimDTO = {
  id: string;
  session_date: string;
  start_time: string;
  hours: number;
  status: ClaimStatus;
  submitted_at: string | null;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  module: { code: string; name: string } | null;
  tutor: LecturerTutorRefDTO | null;
  evidenceCount: number;
  evidencePreview: LecturerEvidencePreviewDTO[];
};

export type LecturerClaimDTO = {
  id: string;
  session_date: string;
  start_time: string;
  hours: number;
  status: ClaimStatus;
  updated_at: string;
  module: { code: string; name: string } | null;
};

export type LecturerAttendanceAlertDTO = {
  id: string;
  severity: "warning" | "error";
  kind: "LOW_ATTENDANCE" | "MISSING_REGISTER";
  moduleCode: string;
  message: string;
  claimId?: string;
};

export type LecturerActivityItemDTO = {
  id: string;
  at: string;
  kind:
    | "CLAIM_SUBMITTED"
    | "STATUS_CHANGED"
    | "DISPUTE_OPENED"
    | "NOTIFICATION";
  message: string;
  tutorName?: string;
  moduleCode?: string;
};

export type LecturerDashboardDataDTO = {
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

export type RawPendingRow = Omit<
  LecturerPendingClaimDTO,
  "module" | "tutor" | "evidenceCount" | "evidencePreview"
> & {
  module: { code: string; name: string } | { code: string; name: string }[] | null;
  tutor: LecturerTutorRefDTO | LecturerTutorRefDTO[] | null;
};

export type RawClaimRow = Omit<LecturerClaimDTO, "module"> & {
  module: { code: string; name: string } | { code: string; name: string }[] | null;
};

export type AlertClaimRow = {
  id: string;
  module_id: string;
  session_date: string;
  status: ClaimStatus;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
};

export type ActivityClaimRow = {
  id: string;
  session_date: string;
  status: ClaimStatus;
  submitted_at: string | null;
  updated_at: string;
  module: { code: string } | { code: string }[] | null;
  tutor: LecturerTutorRefDTO | LecturerTutorRefDTO[] | null;
};

export type AuditRow = {
  id: string;
  entity_id: string;
  event: string;
  payload: { from?: string; to?: string } | null;
  created_at: string;
};

export type DisputeRow = {
  id: string;
  claim_id: string;
  reason: string;
  raised_at: string;
  claim:
    | {
        module: { code: string } | { code: string }[] | null;
        tutor: LecturerTutorRefDTO | LecturerTutorRefDTO[] | null;
      }
    | {
        module: { code: string } | { code: string }[] | null;
        tutor: LecturerTutorRefDTO | LecturerTutorRefDTO[] | null;
      }[]
    | null;
};

export type NotificationRow = {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  sent_at: string | null;
  claim:
    | { module: { code: string } | { code: string }[] | null }
    | { module: { code: string } | { code: string }[] | null }[]
    | null;
};
