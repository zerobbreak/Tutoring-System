import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { ScheduleCalendarView } from "./types";

export function rangeForView(
  view: ScheduleCalendarView,
  focusDate: Date,
): { from: Date; to: Date } {
  const day = startOfDay(focusDate);
  switch (view) {
    case "day":
      return { from: day, to: endOfDay(day) };
    case "week":
      return {
        from: startOfWeek(day, { weekStartsOn: 1 }),
        to: endOfWeek(day, { weekStartsOn: 1 }),
      };
    case "month":
      return { from: startOfMonth(day), to: endOfMonth(day) };
    case "agenda":
      return { from: day, to: endOfDay(addDays(day, 30)) };
    default:
      return { from: startOfMonth(day), to: endOfMonth(day) };
  }
}
