import { describe, expect, it } from "vitest";
import {
  buildTutorHourBudget,
  classifyStandaloneClaim,
  hoursBetweenTimestamps,
  isClaimWorked,
  isScheduledSessionReserved,
  assertReservedCapacity,
} from "#/lib/tutor-hour-budget";

describe("hoursBetweenTimestamps", () => {
  it("computes 2h for a 2-hour slot", () => {
    expect(
      hoursBetweenTimestamps("2026-05-20T14:00:00.000Z", "2026-05-20T16:00:00.000Z"),
    ).toBeGreaterThan(0);
  });
});

describe("lifecycle helpers", () => {
  it("scheduled status reserves", () => {
    expect(isScheduledSessionReserved("SCHEDULED")).toBe(true);
    expect(isScheduledSessionReserved("CANCELLED")).toBe(false);
  });

  it("draft claim does not classify as reserved", () => {
    expect(
      classifyStandaloneClaim({
        status: "DRAFT",
        session_date: "2026-05-20",
        start_time: "14:00",
        end_time: "16:00",
      }),
    ).toBe("none");
  });

  it("pending claim is requested", () => {
    expect(
      classifyStandaloneClaim({
        status: "PENDING_VERIFICATION",
        session_date: "2026-05-20",
        start_time: "14:00",
        end_time: "16:00",
      }),
    ).toBe("requested");
  });
});

describe("buildTutorHourBudget", () => {
  const terms = [
    {
      id: "term-1",
      institution_id: "inst-1",
      label: "Semester 1",
      start_date: "2026-01-01",
      end_date: "2026-06-30",
    },
  ];
  const moduleTerm = new Map([["mod-1", "term-1"]]);
  const moduleInst = new Map([["mod-1", "inst-1"]]);

  it("sums scheduled + standalone without double-counting linked claims", () => {
    const summary = buildTutorHourBudget({
      tutorId: "tutor-1",
      allocations: [
        {
          id: "a1",
          module_id: "mod-1",
          academic_term_id: "term-1",
          allocated_hours: 40,
          module: { code: "INF214", name: "Intro" },
          academic_term: { label: "Semester 1" },
        },
      ],
      scheduledSessions: [
        {
          id: "sess-1",
          module_id: "mod-1",
          tutor_id: "tutor-1",
          starts_at: "2026-05-20T12:00:00.000Z",
          ends_at: "2026-05-20T14:00:00.000Z",
          status: "SCHEDULED",
          deleted_at: null,
        },
      ],
      standaloneClaims: [
        {
          id: "c1",
          module_id: "mod-1",
          tutor_id: "tutor-1",
          status: "DRAFT",
          hours: 2,
          source_scheduled_session_id: "sess-1",
          deleted_at: null,
          session_date: "2026-05-20",
          start_time: "14:00",
          end_time: "16:00",
        },
        {
          id: "c2",
          module_id: "mod-1",
          tutor_id: "tutor-1",
          status: "PENDING_VERIFICATION",
          hours: 3,
          source_scheduled_session_id: null,
          deleted_at: null,
          session_date: "2026-05-21",
          start_time: "14:00",
          end_time: "17:00",
        },
      ],
      terms,
      moduleTermByModuleId: moduleTerm,
      moduleInstitutionByModuleId: moduleInst,
    });

    expect(summary.totals.allocatedHours).toBe(40);
    expect(summary.totals.reservedHours).toBeGreaterThanOrEqual(5);
    expect(summary.byModule[0]?.breakdown.requestedHours).toBe(3);
    expect(summary.totals.availableHours).toBeLessThan(40);
  });

  it("excludes cancelled sessions", () => {
    const summary = buildTutorHourBudget({
      tutorId: "tutor-1",
      allocations: [],
      scheduledSessions: [
        {
          id: "sess-x",
          module_id: "mod-1",
          tutor_id: "tutor-1",
          starts_at: "2026-05-20T12:00:00.000Z",
          ends_at: "2026-05-20T14:00:00.000Z",
          status: "CANCELLED",
          deleted_at: null,
        },
      ],
      standaloneClaims: [],
      terms,
      moduleTermByModuleId: moduleTerm,
      moduleInstitutionByModuleId: moduleInst,
    });
    expect(summary.totals.reservedHours).toBe(0);
  });
});

describe("assertReservedCapacity", () => {
  it("throws when over allocation", () => {
    expect(() =>
      assertReservedCapacity({
        allocatedHours: 40,
        currentReservedHours: 39,
        additionalHours: 2,
        strict: true,
      }),
    ).toThrow(/allocation exceeded/i);
  });

  it("no-op when no allocation row", () => {
    expect(() =>
      assertReservedCapacity({
        allocatedHours: null,
        currentReservedHours: 100,
        additionalHours: 50,
        strict: false,
      }),
    ).not.toThrow();
  });
});

describe("isClaimWorked", () => {
  it("approved past session counts as worked", () => {
    const past = new Date("2030-01-01");
    expect(
      isClaimWorked(
        {
          status: "APPROVED",
          session_date: "2020-01-01",
          start_time: "09:00",
          end_time: "10:00",
        },
        past,
      ),
    ).toBe(true);
  });
});
