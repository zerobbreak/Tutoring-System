import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { ScheduleEventDTO } from "./types";

export const WEEK_STARTS_ON = 1 as const;

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function dayKeyFromDate(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

export function indexEventsByDay(
  events: ScheduleEventDTO[],
): Map<string, ScheduleEventDTO[]> {
  const map = new Map<string, ScheduleEventDTO[]>();
  const sorted = [...events].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  for (const ev of sorted) {
    const key = ev.startsAt.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(ev);
    map.set(key, list);
  }
  return map;
}

export type CalendarDayCell = {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
};

/** Monday-start grid covering full weeks that contain the month. */
export function buildMonthGrid(focusDate: Date): CalendarDayCell[] {
  const monthStart = startOfMonth(focusDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
  const monthEnd = endOfMonth(focusDate);
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });

  const cells: CalendarDayCell[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    cells.push({
      date: cursor,
      key: dayKeyFromDate(cursor),
      inCurrentMonth: isSameMonth(cursor, focusDate),
    });
    cursor = addDays(cursor, 1);
  }
  return cells;
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}
