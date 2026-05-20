import { describe, expect, it } from "vitest";
import { claimSnapshotFromScheduledSession } from "#/lib/schedule-claims/claim-snapshot";
import { diffClaimFromSnapshot } from "#/lib/schedule-claims/diff-claim-from-snapshot";
import type { ScheduledSessionForClaim } from "#/lib/schedule-claims/types";

function sessionRow(
  overrides: Partial<ScheduledSessionForClaim> = {},
): ScheduledSessionForClaim {
  return {
    id: "sess-1",
    module_id: "mod-1",
    tutor_id: "tutor-1",
    starts_at: "2026-06-03T12:00:00.000Z",
    ends_at: "2026-06-03T14:00:00.000Z",
    venue_text: null,
    venue: null,
    series: { session_kind: "tutorial" },
    ...overrides,
  };
}

describe("claimSnapshotFromScheduledSession", () => {
  it("maps timestamps to claim date/time columns", () => {
    const snap = claimSnapshotFromScheduledSession(sessionRow());
    expect(snap.session_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snap.start_time).toMatch(/^\d{2}:\d{2}:00$/);
    expect(snap.end_time).toMatch(/^\d{2}:\d{2}:00$/);
    expect(snap.hours).toBeGreaterThan(0);
  });

  it("prefers venue_text over venue name", () => {
    const snap = claimSnapshotFromScheduledSession(
      sessionRow({
        venue_text: " Room A ",
        venue: { name: "Building B" },
      }),
    );
    expect(snap.venue).toBe("Room A");
  });

  it("falls back to venue name when venue_text empty", () => {
    const snap = claimSnapshotFromScheduledSession(
      sessionRow({
        venue_text: "  ",
        venue: { name: "Lab 2" },
      }),
    );
    expect(snap.venue).toBe("Lab 2");
  });

  it("uses LECTURER_ONE_OFF creation source for one_off series", () => {
    const snap = claimSnapshotFromScheduledSession(
      sessionRow({ series: { session_kind: "one_off" } }),
    );
    expect(snap.creation_source).toBe("LECTURER_ONE_OFF");
    expect(snap.session_kind).toBe("one_off");
  });

  it("uses SCHEDULE creation source for recurring series", () => {
    const snap = claimSnapshotFromScheduledSession(sessionRow());
    expect(snap.creation_source).toBe("SCHEDULE");
  });
});

describe("diffClaimFromSnapshot", () => {
  it("returns empty when claim matches snapshot", () => {
    const snap = claimSnapshotFromScheduledSession(sessionRow());
    expect(
      diffClaimFromSnapshot(
        {
          session_date: snap.session_date,
          start_time: snap.start_time,
          end_time: snap.end_time,
          hours: snap.hours,
          venue: snap.venue,
        },
        snap,
      ),
    ).toEqual([]);
  });

  it("detects date, time, hours, and venue mismatches", () => {
    const snap = claimSnapshotFromScheduledSession(sessionRow());
    const mismatches = diffClaimFromSnapshot(
      {
        session_date: "2020-01-01",
        start_time: "09:00:00",
        end_time: "10:00:00",
        hours: 1,
        venue: "Other",
      },
      { ...snap, venue: "Room A" },
    );
    expect(mismatches).toContain("date");
    expect(mismatches).toContain("time");
    expect(mismatches).toContain("hours");
    expect(mismatches).toContain("venue");
  });

  it("ignores venue diff when either side has no venue", () => {
    const snap = claimSnapshotFromScheduledSession(sessionRow());
    expect(
      diffClaimFromSnapshot(
        {
          session_date: snap.session_date,
          start_time: snap.start_time,
          end_time: snap.end_time,
          hours: snap.hours,
          venue: "Room A",
        },
        { ...snap, venue: null },
      ),
    ).not.toContain("venue");
  });
});
