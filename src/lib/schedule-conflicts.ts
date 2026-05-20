import {
  addDays,
  differenceInMinutes,
  isBefore,
  parseISO,
  startOfWeek,
} from "date-fns";

export type ScheduleSessionLike = {
  id: string;
  tutorId: string;
  tutorName?: string;
  venueId: string | null;
  venueName?: string | null;
  moduleId: string;
  moduleCode?: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type SchedulingIssueKind =
  | "tutor_double_booking"
  | "venue_conflict"
  | "tutor_overload"
  | "allocation_exceeded"
  | "missing_schedule";

export type SchedulingIssue = {
  kind: SchedulingIssueKind;
  message: string;
  sessionIds: string[];
  tutorId?: string;
  venueId?: string;
  moduleId?: string;
  weekStart?: string;
  hours?: number;
  maxHours?: number;
  allocatedHours?: number;
  reservedHours?: number;
};

export type MissingCoverageInput = {
  moduleId: string;
  moduleCode: string;
  tutorId: string;
  tutorName: string;
};

export type PublishedSeriesLike = {
  moduleId: string;
  tutorId: string;
  status: string;
  academicTermId: string | null;
};

const ACTIVE_STATUSES = new Set(["SCHEDULED", "RESCHEDULED"]);

export function isActiveScheduledSession(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function sessionsOverlap(
  a: Pick<ScheduleSessionLike, "startsAt" | "endsAt" | "status">,
  b: Pick<ScheduleSessionLike, "startsAt" | "endsAt" | "status">,
): boolean {
  if (!isActiveScheduledSession(a.status) || !isActiveScheduledSession(b.status)) {
    return false;
  }
  const aStart = parseISO(a.startsAt);
  const aEnd = parseISO(a.endsAt);
  const bStart = parseISO(b.startsAt);
  const bEnd = parseISO(b.endsAt);
  return aStart < bEnd && bStart < aEnd;
}

export function detectTutorDoubleBookings(
  sessions: ScheduleSessionLike[],
): SchedulingIssue[] {
  const active = sessions.filter((s) => isActiveScheduledSession(s.status));
  const issues: SchedulingIssue[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      if (a.tutorId !== b.tutorId) continue;
      if (!sessionsOverlap(a, b)) continue;

      const key = [a.id, b.id].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);

      issues.push({
        kind: "tutor_double_booking",
        message: `${a.tutorName ?? "Tutor"} is double-booked (${a.moduleCode ?? "session"} overlaps another).`,
        sessionIds: [a.id, b.id],
        tutorId: a.tutorId,
      });
    }
  }

  return issues;
}

export function detectVenueConflicts(
  sessions: ScheduleSessionLike[],
): SchedulingIssue[] {
  const active = sessions.filter(
    (s) => isActiveScheduledSession(s.status) && s.venueId,
  );
  const issues: SchedulingIssue[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      if (a.venueId !== b.venueId) continue;
      if (!sessionsOverlap(a, b)) continue;

      const key = [a.id, b.id].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);

      issues.push({
        kind: "venue_conflict",
        message: `Venue ${a.venueName ?? "conflict"} is double-booked.`,
        sessionIds: [a.id, b.id],
        venueId: a.venueId ?? undefined,
      });
    }
  }

  return issues;
}

export function computeTutorWeeklyHours(
  sessions: ScheduleSessionLike[],
  weekStart: Date,
): Map<string, number> {
  const weekEnd = addDays(weekStart, 7);
  const hoursByTutor = new Map<string, number>();

  for (const s of sessions) {
    if (!isActiveScheduledSession(s.status)) continue;
    const start = parseISO(s.startsAt);
    if (isBefore(start, weekStart) || !isBefore(start, weekEnd)) continue;

    const minutes = differenceInMinutes(parseISO(s.endsAt), start);
    const hours = minutes / 60;
    hoursByTutor.set(s.tutorId, (hoursByTutor.get(s.tutorId) ?? 0) + hours);
  }

  return hoursByTutor;
}

export function findTutorOverload(
  sessions: ScheduleSessionLike[],
  maxHoursPerWeek: number,
  referenceDate: Date = new Date(),
): SchedulingIssue[] {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const hoursByTutor = computeTutorWeeklyHours(sessions, weekStart);
  const issues: SchedulingIssue[] = [];

  for (const [tutorId, hours] of hoursByTutor) {
    if (hours <= maxHoursPerWeek) continue;
    const tutorName =
      sessions.find((s) => s.tutorId === tutorId)?.tutorName ?? "Tutor";
    const weekSessionIds = sessions
      .filter((s) => {
        if (s.tutorId !== tutorId || !isActiveScheduledSession(s.status)) {
          return false;
        }
        const start = parseISO(s.startsAt);
        const weekEnd = addDays(weekStart, 7);
        return !isBefore(start, weekStart) && isBefore(start, weekEnd);
      })
      .map((s) => s.id);

    issues.push({
      kind: "tutor_overload",
      message: `${tutorName} has ${hours.toFixed(1)}h scheduled this week (max ${maxHoursPerWeek}h).`,
      sessionIds: weekSessionIds,
      tutorId,
      weekStart: weekStart.toISOString(),
      hours: Math.round(hours * 10) / 10,
      maxHours: maxHoursPerWeek,
    });
  }

  return issues;
}

export function findMissingCoverage(
  assignments: MissingCoverageInput[],
  publishedSeries: PublishedSeriesLike[],
  academicTermId: string | null,
): SchedulingIssue[] {
  const publishedKeys = new Set(
    publishedSeries
      .filter((s) => s.status === "PUBLISHED")
      .filter((s) =>
        academicTermId
          ? s.academicTermId === academicTermId || s.academicTermId === null
          : true,
      )
      .map((s) => `${s.moduleId}:${s.tutorId}`),
  );

  const issues: SchedulingIssue[] = [];
  const seen = new Set<string>();

  for (const a of assignments) {
    const key = `${a.moduleId}:${a.tutorId}`;
    if (publishedKeys.has(key) || seen.has(key)) continue;
    seen.add(key);

    issues.push({
      kind: "missing_schedule",
      message: `No published schedule for ${a.tutorName} on ${a.moduleCode}.`,
      sessionIds: [],
      moduleId: a.moduleId,
      tutorId: a.tutorId,
    });
  }

  return issues;
}

export type AllocationBudgetRow = {
  tutorId: string;
  tutorName?: string;
  moduleId: string;
  moduleCode: string;
  allocatedHours: number;
  reservedHours: number;
};

export function findAllocationExceeded(
  rows: AllocationBudgetRow[],
): SchedulingIssue[] {
  const issues: SchedulingIssue[] = [];
  for (const row of rows) {
    if (row.allocatedHours <= 0) continue;
    if (row.reservedHours <= row.allocatedHours) continue;
    const name = row.tutorName ?? "Tutor";
    issues.push({
      kind: "allocation_exceeded",
      message: `${name} on ${row.moduleCode}: ${row.reservedHours.toFixed(1)}h reserved exceeds ${row.allocatedHours.toFixed(1)}h allocated.`,
      sessionIds: [],
      tutorId: row.tutorId,
      moduleId: row.moduleId,
      allocatedHours: row.allocatedHours,
      reservedHours: row.reservedHours,
    });
  }
  return issues;
}

export function detectAllSchedulingIssues(input: {
  sessions: ScheduleSessionLike[];
  assignments: MissingCoverageInput[];
  publishedSeries: PublishedSeriesLike[];
  maxHoursPerWeek: number;
  academicTermId: string | null;
  referenceDate?: Date;
  allocationRows?: AllocationBudgetRow[];
}): SchedulingIssue[] {
  return [
    ...detectTutorDoubleBookings(input.sessions),
    ...detectVenueConflicts(input.sessions),
    ...findTutorOverload(
      input.sessions,
      input.maxHoursPerWeek,
      input.referenceDate,
    ),
    ...findAllocationExceeded(input.allocationRows ?? []),
    ...findMissingCoverage(
      input.assignments,
      input.publishedSeries,
      input.academicTermId,
    ),
  ];
}
