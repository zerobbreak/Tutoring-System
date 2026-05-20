import type { ClaimStatus } from "#/lib/session-claim-display";
import type { LecturerAttendanceAlertDTO } from "#/server-actions/lecturer-dashboard/types";

export type AttendanceTrendPointDTO = {
  date: string;
  dateLabel: string;
  present: number;
  expected: number;
  rate: number | null;
  sessionCount: number;
};

export type ModuleParticipationDTO = {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  sessionCount: number;
  averageRate: number | null;
  totalScans: number;
};

export type LowAttendanceSessionDTO = {
  id: string;
  session_date: string;
  start_time: string;
  moduleCode: string;
  tutorName: string;
  present: number;
  expected: number;
  rate: number;
  scanCount: number;
  status: ClaimStatus;
};

export type IntegrityIssueDTO = {
  id: string;
  kind:
    | "HEADCOUNT_MISMATCH"
    | "MISSING_REGISTER"
    | "UNVERIFIED_SCANS"
    | "SCHEDULE_MISMATCH";
  claimId: string;
  moduleCode: string;
  session_date: string;
  message: string;
};

export type LiveAttendanceSessionDTO = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  moduleCode: string;
  tutorName: string;
  scanCount: number;
  presentCount: number | null;
  expectedCount: number | null;
  qrActive: boolean;
};

export type PeakHourDTO = {
  hour: number;
  label: string;
  scanCount: number;
};

export type LecturerAttendanceDashboardDTO = {
  lookbackDays: number;
  totalPresent: number;
  totalExpected: number;
  averageRate: number | null;
  totalScans: number;
  sessionsWithAttendance: number;
  trendSeries: AttendanceTrendPointDTO[];
  moduleParticipation: ModuleParticipationDTO[];
  lowSessions: LowAttendanceSessionDTO[];
  alerts: LecturerAttendanceAlertDTO[];
  integrityIssues: IntegrityIssueDTO[];
  liveSessions: LiveAttendanceSessionDTO[];
  peakHours: PeakHourDTO[];
};
