import type {
  CancelledScheduleRowDTO,
  LecturerSessionCardDTO,
  LecturerSessionDetailDTO,
} from "#/server-actions/lecturer-sessions";

export type AdminSessionCardDTO = LecturerSessionCardDTO;
export type { CancelledScheduleRowDTO };

export type AdminSessionFilterOptionDTO = {
  id: string;
  fullName: string;
  email: string;
};

export type AdminModuleOptionDTO = {
  id: string;
  code: string;
  name: string;
};

export type AdminSessionsSummaryDTO = {
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  averageAttendanceRate: number | null;
  openDisputesCount: number;
  missingRegisterCount: number;
  liveQrCount: number;
};

export type AdminSessionsPageDataDTO = {
  summary: AdminSessionsSummaryDTO;
  active: AdminSessionCardDTO[];
  completed: AdminSessionCardDTO[];
  cancelledSchedule: CancelledScheduleRowDTO[];
  rejectedClaims: AdminSessionCardDTO[];
  modules: AdminModuleOptionDTO[];
  tutors: AdminSessionFilterOptionDTO[];
  lecturers: AdminSessionFilterOptionDTO[];
};

export type AdminSessionDisputeDTO = {
  id: string;
  status: string;
  reason: string;
  raised_at: string;
  resolution_note: string | null;
};

export type AdminSessionDetailDTO = LecturerSessionDetailDTO & {
  disputes: AdminSessionDisputeDTO[];
  open_dispute: boolean;
};
