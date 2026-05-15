import { format, startOfDay } from "date-fns";
import {
  type ScheduleParseResult,
  type ScheduleParsedEvent,
} from "#/lib/schedule-spreadsheet";

export function typeColumnFlagForEvent(
  ev: ScheduleParsedEvent,
  merged: ScheduleParseResult,
): boolean {
  return ev.sessionTypeFromSource ?? merged.sessionTypeColumnPresent;
}

export function formatTimeRange(isoStart: string, isoEnd: string): string {
  const a = new Date(isoStart);
  const b = new Date(isoEnd);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()))
    return `${isoStart} – ${isoEnd}`;
  const tf = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${tf.format(a)}–${tf.format(b)}`;
}

export function dayKey(date: Date): string {
  return format(startOfDay(date), "yyyy-MM-dd");
}

export function dayHeadingLong(value: Date): string {
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export function groupEventsByDay(
  events: ScheduleParsedEvent[],
): Map<string, ScheduleParsedEvent[]> {
  const map = new Map<string, ScheduleParsedEvent[]>();
  const sorted = [...events].sort(
    (x, y) => new Date(x.start).getTime() - new Date(y.start).getTime(),
  );
  for (const e of sorted) {
    const key = e.start.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return map;
}
