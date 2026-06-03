import { describe, expect, it } from "vitest";
import {
  detectAllSchedulingIssues,
  type ScheduleSessionLike,
} from "#/lib/schedule-conflicts";

describe("assert conflict filtering", () => {
  it("detects double-booking between proposed pending id and existing session", () => {
    const existing: ScheduleSessionLike = {
      id: "sess-a",
      tutorId: "tutor-1",
      moduleId: "mod-1",
      moduleCode: "CS",
      startsAt: "2026-06-10T09:00:00.000Z",
      endsAt: "2026-06-10T10:00:00.000Z",
      status: "SCHEDULED",
      venueId: null,
    };
    const proposed: ScheduleSessionLike = {
      id: "pending-2026-06-10T09:30:00.000Z",
      tutorId: "tutor-1",
      moduleId: "mod-1",
      startsAt: "2026-06-10T09:30:00.000Z",
      endsAt: "2026-06-10T10:30:00.000Z",
      status: "SCHEDULED",
      venueId: null,
    };

    const issues = detectAllSchedulingIssues({
      sessions: [existing, proposed],
      assignments: [],
      publishedSeries: [],
      maxHoursPerWeek: 40,
      academicTermId: null,
    });

    const doubleBook = issues.filter((i) => i.kind === "tutor_double_booking");
    expect(doubleBook.length).toBeGreaterThan(0);
    expect(
      doubleBook.some((i) =>
        i.sessionIds.includes("sess-a") || i.sessionIds.includes(proposed.id),
      ),
    ).toBe(true);
  });
});
