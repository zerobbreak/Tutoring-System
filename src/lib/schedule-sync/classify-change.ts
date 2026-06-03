import type {
  ScheduleSyncEvent,
  ScheduleSyncEventType,
  ScheduledSessionSnapshot,
} from "#/lib/schedule-sync/types";

function venueLabel(s: ScheduledSessionSnapshot): string {
  return s.venueText?.trim() || s.claimSnapshot.venue || "—";
}

/** Derive sync events from before/after schedule snapshots. */
export function classifyScheduleChange(input: {
  actorId: string;
  before: ScheduledSessionSnapshot | null;
  after: ScheduledSessionSnapshot;
}): ScheduleSyncEvent[] {
  const { before, after, actorId } = input;
  const events: ScheduleSyncEvent[] = [];
  const base = {
    scheduledSessionId: after.id,
    institutionId: after.institutionId,
    actorId,
    before,
    after,
  };

  if (!before) {
    return events;
  }

  if (before.status !== "CANCELLED" && after.status === "CANCELLED") {
    events.push({ type: "SESSION_CANCELLED", ...base });
    return events;
  }

  if (before.status === "CANCELLED" && after.status !== "CANCELLED") {
    events.push({ type: "SESSION_RESTORED", ...base });
  }

  if (before.tutorId !== after.tutorId) {
    events.push({ type: "TUTOR_REASSIGNED", ...base });
  }

  if (before.startsAt !== after.startsAt || before.endsAt !== after.endsAt) {
    events.push({ type: "SESSION_TIME_CHANGED", ...base });
  }

  const beforeVenue = venueLabel(before);
  const afterVenue = venueLabel(after);
  if (before.venueId !== after.venueId || beforeVenue !== afterVenue) {
    events.push({ type: "VENUE_CHANGED", ...base });
  }

  return events;
}

export function eventTypeLabel(type: ScheduleSyncEventType): string {
  switch (type) {
    case "SESSION_TIME_CHANGED":
      return "Session time updated";
    case "VENUE_CHANGED":
      return "Venue updated";
    case "TUTOR_REASSIGNED":
      return "Tutor reassigned";
    case "SESSION_CANCELLED":
      return "Session cancelled";
    case "SESSION_RESTORED":
      return "Session restored";
    default:
      return "Schedule updated";
  }
}
