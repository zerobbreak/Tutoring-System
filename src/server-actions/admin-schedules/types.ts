import type {
  ScheduleChangeRequestDTO,
  ScheduleEventDTO,
  ScheduleModuleOptionDTO,
  ScheduleSeriesDTO,
  ScheduleTutorOptionDTO,
  VenueDTO,
} from "#/server-actions/lecturer-schedule";
import type { SchedulingIssue } from "#/lib/schedule-conflicts";

export type { ScheduleEventDTO, ScheduleSeriesDTO, ScheduleChangeRequestDTO };

export type AdminScheduleCalendarScope =
  | "institution"
  | "module"
  | "tutor"
  | "lecturer";

export type AcademicTermOptionDTO = {
  id: string;
  label: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export type ScheduleLecturerOptionDTO = {
  id: string;
  fullName: string;
  email: string;
};

export type AdminSchedulePageDataDTO = {
  modules: ScheduleModuleOptionDTO[];
  tutors: ScheduleTutorOptionDTO[];
  lecturers: ScheduleLecturerOptionDTO[];
  academicTerms: AcademicTermOptionDTO[];
  currentTermId: string | null;
  maxTutorHoursPerWeek: number;
  tutorIdsByModule: Record<string, string[]>;
  venues: VenueDTO[];
  events: ScheduleEventDTO[];
  series: ScheduleSeriesDTO[];
  pendingChangeRequests: ScheduleChangeRequestDTO[];
  scope: AdminScheduleCalendarScope;
  scopeEntityId: string | null;
};

export type DetectSchedulingIssuesResultDTO = {
  issues: SchedulingIssue[];
  maxTutorHoursPerWeek: number;
};
