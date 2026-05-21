import type { ClaimSnapshot } from "#/lib/schedule-claims/types";

export const SCHEDULE_SYNC_EVENT_TYPES = [
  "SESSION_TIME_CHANGED",
  "VENUE_CHANGED",
  "TUTOR_REASSIGNED",
  "SESSION_CANCELLED",
  "SESSION_RESTORED",
] as const;

export type ScheduleSyncEventType = (typeof SCHEDULE_SYNC_EVENT_TYPES)[number];

export type ScheduledSessionSnapshot = {
  id: string;
  institutionId: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  lecturerId: string | null;
  tutorId: string;
  startsAt: string;
  endsAt: string;
  venueId: string | null;
  venueText: string | null;
  status: string;
  claimSnapshot: ClaimSnapshot;
};

export type ScheduleSyncEvent = {
  type: ScheduleSyncEventType;
  scheduledSessionId: string;
  institutionId: string;
  actorId: string;
  before: ScheduledSessionSnapshot | null;
  after: ScheduledSessionSnapshot;
};

export type ScheduleSyncHandlerResult = {
  claimId: string | null;
  skippedClaimSync: boolean;
};
