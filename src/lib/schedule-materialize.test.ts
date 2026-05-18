import { describe, expect, it } from "vitest";
import {
  occurrenceKey,
  planMaterializeActions,
  needsHorizonExtension,
} from "#/lib/schedule-materialize";
import type { ExistingScheduledRow } from "#/lib/schedule-materialize";
import { materializeWeeklyOccurrences } from "#/lib/schedule-recurrence";

describe("planMaterializeActions", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("plans insert for new occurrences", () => {
    const occurrences = materializeWeeklyOccurrences({
      dtstart: new Date("2026-06-03T14:00:00.000Z"),
      durationMinutes: 120,
      recurrence: { frequency: "weekly", byWeekday: [3], until: "2026-06-24" },
    });
    const plan = planMaterializeActions(occurrences, [], now);
    expect(plan.actions.filter((a) => a.kind === "insert").length).toBe(
      occurrences.length,
    );
  });

  it("does not cancel past SCHEDULED slots missing from template", () => {
    const starts = "2026-05-28T14:00:00.000Z";
    const existing: ExistingScheduledRow[] = [
      {
        id: "sess-1",
        starts_at: starts,
        ends_at: "2026-05-28T16:00:00.000Z",
        status: "SCHEDULED",
        deleted_at: null,
      },
    ];
    const plan = planMaterializeActions([], existing, now);
    expect(plan.actions.some((a) => a.kind === "cancel")).toBe(false);
  });

  it("cancels future SCHEDULED slots removed from template", () => {
    const futureStart = "2026-06-10T14:00:00.000Z";
    const existing: ExistingScheduledRow[] = [
      {
        id: "sess-future",
        starts_at: futureStart,
        ends_at: "2026-06-10T16:00:00.000Z",
        status: "SCHEDULED",
        deleted_at: null,
      },
    ];
    const plan = planMaterializeActions([], existing, now);
    expect(plan.actions).toEqual([{ kind: "cancel", sessionId: "sess-future" }]);
  });

  it("plans restore for soft-deleted row at same start", () => {
    const starts = "2026-06-10T14:00:00.000Z";
    const ends = "2026-06-10T16:00:00.000Z";
    const existing: ExistingScheduledRow[] = [
      {
        id: "sess-deleted",
        starts_at: starts,
        ends_at: ends,
        status: "SCHEDULED",
        deleted_at: "2026-06-01T00:00:00.000Z",
      },
    ];
    const occurrences = [
      { startsAt: new Date(starts), endsAt: new Date(ends) },
    ];
    const plan = planMaterializeActions(occurrences, existing, now);
    expect(plan.actions).toEqual([
      { kind: "restore", sessionId: "sess-deleted", endsAt: ends },
    ]);
  });

  it("stable occurrence keys", () => {
    const d = new Date("2026-06-10T14:00:00.000Z");
    expect(occurrenceKey(d)).toBe(d.toISOString());
  });
});

describe("needsHorizonExtension", () => {
  it("returns true when never materialized", () => {
    expect(needsHorizonExtension(null)).toBe(true);
  });

  it("returns false when horizon is far ahead", () => {
    const far = new Date();
    far.setDate(far.getDate() + 60);
    expect(needsHorizonExtension(far.toISOString())).toBe(false);
  });
});
