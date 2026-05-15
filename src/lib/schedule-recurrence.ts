import { addDays, addMinutes, addWeeks, isAfter, isBefore, startOfDay } from "date-fns";

export type ScheduleRecurrenceJson = {
  frequency: "weekly";
  /** 0 = Sunday … 6 = Saturday (matches JS Date.getDay()) */
  byWeekday: number[];
  /** ISO date YYYY-MM-DD inclusive end, or null for default horizon */
  until: string | null;
};

export const DEFAULT_PUBLISH_HORIZON_WEEKS = 16;

export function parseRecurrenceJson(raw: unknown): ScheduleRecurrenceJson {
  if (!raw || typeof raw !== "object") {
    return { frequency: "weekly", byWeekday: [1], until: null };
  }
  const o = raw as Record<string, unknown>;
  const byWeekday = Array.isArray(o.byWeekday)
    ? o.byWeekday.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
    : [1];
  return {
    frequency: "weekly",
    byWeekday: byWeekday.length ? byWeekday : [1],
    until: typeof o.until === "string" ? o.until : null,
  };
}

export type MaterializedOccurrence = {
  startsAt: Date;
  endsAt: Date;
};

/** Expand weekly recurrence from dtstart for up to horizon weeks or until date. */
export function materializeWeeklyOccurrences(input: {
  dtstart: Date;
  durationMinutes: number;
  recurrence: ScheduleRecurrenceJson;
  horizonWeeks?: number;
}): MaterializedOccurrence[] {
  const horizonWeeks = input.horizonWeeks ?? DEFAULT_PUBLISH_HORIZON_WEEKS;
  const untilDate = input.recurrence.until
    ? startOfDay(new Date(`${input.recurrence.until}T23:59:59`))
    : addWeeks(input.dtstart, horizonWeeks);

  const weekdays = new Set(input.recurrence.byWeekday);
  const out: MaterializedOccurrence[] = [];
  let cursor = startOfDay(input.dtstart);

  const endScan = addWeeks(input.dtstart, horizonWeeks + 1);
  const scanEnd = isBefore(untilDate, endScan) ? untilDate : endScan;

  while (!isAfter(cursor, scanEnd)) {
    if (weekdays.has(cursor.getDay())) {
      const startsAt = new Date(cursor);
      startsAt.setHours(
        input.dtstart.getHours(),
        input.dtstart.getMinutes(),
        input.dtstart.getSeconds(),
        0,
      );
      if (!isBefore(startsAt, input.dtstart)) {
        const endsAt = addMinutes(startsAt, input.durationMinutes);
        if (!isAfter(startsAt, untilDate)) {
          out.push({ startsAt, endsAt });
        }
      }
    }
    cursor = addDays(cursor, 1);
  }

  return out;
}
