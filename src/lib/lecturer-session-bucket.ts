import { isSameDay } from "date-fns";
import { sessionBoundsLocal } from "#/lib/session-kanban-column";

export type LecturerSessionTimeBucket = "today" | "upcoming" | "completed";

/** Calendar bucket for lecturer monitoring (ignores claim workflow status). */
export function lecturerSessionTimeBucket(
  now: Date,
  sessionDate: string,
  startTime: string,
  endTime: string,
): LecturerSessionTimeBucket {
  const { start, end } = sessionBoundsLocal(sessionDate, startTime, endTime);

  if (end.getTime() < now.getTime()) {
    return "completed";
  }

  if (isSameDay(start, now)) {
    return "today";
  }

  if (start.getTime() > now.getTime()) {
    return "upcoming";
  }

  return "today";
}
