export type ScheduleCalendarView = "month" | "week" | "day" | "agenda";

export type VenueDTO = {
  id: string;
  name: string;
  code: string | null;
  capacity: number | null;
  isActive: boolean;
};

export type ScheduleModuleOptionDTO = {
  id: string;
  code: string;
  name: string;
};

export type ScheduleTutorOptionDTO = {
  id: string;
  fullName: string;
  email: string;
};

export type ScheduleEventDTO = {
  id: string;
  seriesId: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  title: string;
  tutorId: string;
  tutorName: string;
  startsAt: string;
  endsAt: string;
  venueName: string | null;
  venueText: string | null;
  status: string;
  sessionKind: string;
  claimId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
};

export type ScheduleSeriesDTO = {
  id: string;
  moduleId: string;
  moduleCode: string;
  title: string;
  sessionKind: string;
  tutorId: string;
  tutorName: string;
  venueId: string | null;
  venueText: string | null;
  timezone: string;
  dtstart: string;
  durationMinutes: number;
  recurrence:
    | {
        frequency: "weekly";
        byWeekday: number[];
        until: string | null;
      }
    | {
        frequency: "explicit_dates";
        dates: string[];
      };
  status: string;
  publishedAt: string | null;
};

export type ScheduleChangeRequestDTO = {
  id: string;
  scheduledSessionId: string;
  status: string;
  proposedStartsAt: string;
  proposedEndsAt: string;
  proposedVenueName: string | null;
  reason: string | null;
  tutorName: string;
  moduleCode: string;
  sessionTitle: string;
  currentStartsAt: string;
  currentEndsAt: string;
  createdAt: string;
};

export type TutorSessionRequestCapacityDTO = {
  allocatedHours: number | null;
  reservedHours: number;
  requestedHours: number;
  availableHours: number | null;
  canApprove: boolean;
  warning: string | null;
};

export type TutorSessionRequestDTO = {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  hours: number;
  venue: string | null;
  sessionKind: string | null;
  requestReason: string | null;
  requestStatus: string;
  reviewFeedback: string | null;
  updatedAt: string;
  tutorName: string;
  moduleCode: string;
  moduleName: string;
  capacity: TutorSessionRequestCapacityDTO;
};

export type LecturerSchedulePageDataDTO = {
  modules: ScheduleModuleOptionDTO[];
  tutors: ScheduleTutorOptionDTO[];
  /** module id → tutor ids with an active assignment */
  tutorIdsByModule: Record<string, string[]>;
  venues: VenueDTO[];
  events: ScheduleEventDTO[];
  series: ScheduleSeriesDTO[];
  pendingChangeRequests: ScheduleChangeRequestDTO[];
  pendingTutorSessionRequests: TutorSessionRequestDTO[];
};
