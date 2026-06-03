import { describe, expect, it } from "vitest";
import { classifyScheduleChange } from "#/lib/schedule-sync/classify-change";
import type { ScheduledSessionSnapshot } from "#/lib/schedule-sync/types";

function baseSnapshot(
  overrides: Partial<ScheduledSessionSnapshot> = {},
): ScheduledSessionSnapshot {
  return {
    id: "sess-1",
    institutionId: "inst-1",
    moduleId: "mod-1",
    moduleCode: "CS101",
    moduleName: "Intro",
    lecturerId: "lec-1",
    tutorId: "tutor-1",
    startsAt: "2026-06-01T09:00:00.000Z",
    endsAt: "2026-06-01T10:00:00.000Z",
    venueId: null,
    venueText: "Room A",
    status: "SCHEDULED",
    claimSnapshot: {
      tutor_id: "tutor-1",
      module_id: "mod-1",
      session_date: "2026-06-01",
      start_time: "09:00:00",
      end_time: "10:00:00",
      hours: 1,
      venue: "Room A",
      session_kind: "tutorial",
      creation_source: "SCHEDULE",
      source_scheduled_session_id: "sess-1",
    },
    ...overrides,
  };
}

describe("classifyScheduleChange", () => {
  it("emits SESSION_CANCELLED when status becomes CANCELLED", () => {
    const before = baseSnapshot();
    const after = baseSnapshot({ status: "CANCELLED" });
    const events = classifyScheduleChange({
      actorId: "actor-1",
      before,
      after,
    });
    expect(events.map((e) => e.type)).toEqual(["SESSION_CANCELLED"]);
  });

  it("emits time and venue events independently", () => {
    const before = baseSnapshot();
    const after = baseSnapshot({
      startsAt: "2026-06-01T10:00:00.000Z",
      endsAt: "2026-06-01T11:00:00.000Z",
      venueText: "Room B",
    });
    const types = classifyScheduleChange({
      actorId: "actor-1",
      before,
      after,
    }).map((e) => e.type);
    expect(types).toContain("SESSION_TIME_CHANGED");
    expect(types).toContain("VENUE_CHANGED");
  });

  it("emits TUTOR_REASSIGNED when tutor changes", () => {
    const before = baseSnapshot();
    const after = baseSnapshot({ tutorId: "tutor-2" });
    const types = classifyScheduleChange({
      actorId: "actor-1",
      before,
      after,
    }).map((e) => e.type);
    expect(types).toContain("TUTOR_REASSIGNED");
  });
});
