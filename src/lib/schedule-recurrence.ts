import { addDays, addMinutes, addWeeks, isAfter, isBefore, startOfDay } from "date-fns";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type WeeklyRecurrenceJson = {
  frequency: "weekly";
  /** 0 = Sunday … 6 = Saturday (matches JS Date.getDay()) */
  byWeekday: number[];
  /** ISO date YYYY-MM-DD inclusive end, or null for default horizon */
  until: string | null;
};

export type ExplicitDatesRecurrenceJson = {
  frequency: "explicit_dates";
  /** ISO dates YYYY-MM-DD — one session per date at the series start time */
  dates: string[];
};

export type ScheduleRecurrenceJson =
  | WeeklyRecurrenceJson
  | ExplicitDatesRecurrenceJson;

export const DEFAULT_PUBLISH_HORIZON_WEEKS = 16;

function parseIsoDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const dates = raw.filter(
    (d): d is string => typeof d === "string" && ISO_DATE_RE.test(d),
  );
  return [...new Set(dates)].sort();
}

export function parseRecurrenceJson(raw: unknown): ScheduleRecurrenceJson {
  if (!raw || typeof raw !== "object") {
    return { frequency: "weekly", byWeekday: [1], until: null };
  }
  const o = raw as Record<string, unknown>;
  if (o.frequency === "explicit_dates") {
    const dates = parseIsoDates(o.dates);
    return { frequency: "explicit_dates", dates };
  }
  const byWeekday = Array.isArray(o.byWeekday)
    ? o.byWeekday.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
    : [1];
  return {
    frequency: "weekly",
    byWeekday: byWeekday.length ? byWeekday : [1],
    until: typeof o.until === "string" ? o.until : null,
  };
}

export function isExplicitDatesRecurrence(
  recurrence: ScheduleRecurrenceJson,
): recurrence is ExplicitDatesRecurrenceJson {
  return recurrence.frequency === "explicit_dates";
}

export type MaterializedOccurrence = {
  startsAt: Date;
  endsAt: Date;
};

/** One session per listed date, using the time-of-day from dtstart. */
export function materializeExplicitDatesOccurrences(input: {
  dtstart: Date;
  durationMinutes: number;
  recurrence: ExplicitDatesRecurrenceJson;
}): MaterializedOccurrence[] {
  const out: MaterializedOccurrence[] = [];
  for (const dateStr of input.recurrence.dates) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const startsAt = new Date(y, m - 1, d);
    startsAt.setHours(
      input.dtstart.getHours(),
      input.dtstart.getMinutes(),
      input.dtstart.getSeconds(),
      0,
    );
    out.push({
      startsAt,
      endsAt: addMinutes(startsAt, input.durationMinutes),
    });
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Expand weekly recurrence from dtstart for up to horizon weeks or until date. */
export function materializeWeeklyOccurrences(input: {
  dtstart: Date;
  durationMinutes: number;
  recurrence: WeeklyRecurrenceJson;
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

export function materializeOccurrences(input: {
  dtstart: Date;
  durationMinutes: number;
  recurrence: ScheduleRecurrenceJson;
  horizonWeeks?: number;
}): MaterializedOccurrence[] {
  if (isExplicitDatesRecurrence(input.recurrence)) {
    return materializeExplicitDatesOccurrences({
      dtstart: input.dtstart,
      durationMinutes: input.durationMinutes,
      recurrence: input.recurrence,
    });
  }
  return materializeWeeklyOccurrences({
    dtstart: input.dtstart,
    durationMinutes: input.durationMinutes,
    recurrence: input.recurrence,
    horizonWeeks: input.horizonWeeks,
  });
}

/** Build series dtstart ISO string from the first session date and HH:mm time. */
export function buildDtstartFromDateAndTime(
  firstDate: string,
  time: string,
): string {
  const [hours, minutes] = time.split(":").map(Number);
  const [y, m, d] = firstDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d, hours, minutes, 0, 0);
  return dt.toISOString();
}
