import { describe, expect, it } from "vitest";
import {
  attendancePhaseLabel,
  canScanForAttendancePhase,
  getAttendancePhase,
} from "#/lib/attendance-phase";

const baseInput = {
  attendance_locked_at: null,
  frozen_at: null,
  session_date: "2026-06-15",
  start_time: "10:00:00",
  end_time: "11:00:00",
  scheduled_starts_at: "2026-06-15T08:00:00.000Z",
  scheduled_ends_at: "2026-06-15T09:00:00.000Z",
};

describe("getAttendancePhase", () => {
  it("returns FINALIZED when claim is frozen", () => {
    expect(
      getAttendancePhase(
        { ...baseInput, frozen_at: "2026-06-15T12:00:00.000Z" },
        new Date("2026-06-15T08:30:00.000Z"),
      ),
    ).toBe("FINALIZED");
  });

  it("returns LOCKED when attendance_locked_at is set", () => {
    expect(
      getAttendancePhase(
        { ...baseInput, attendance_locked_at: "2026-06-15T09:30:00.000Z" },
        new Date("2026-06-15T08:30:00.000Z"),
      ),
    ).toBe("LOCKED");
  });

  it("returns OPEN within QR window", () => {
    expect(
      getAttendancePhase(baseInput, new Date("2026-06-15T08:00:00.000Z")),
    ).toBe("OPEN");
  });

  it("returns CLOSED before QR window", () => {
    expect(
      getAttendancePhase(baseInput, new Date("2026-06-14T08:00:00.000Z")),
    ).toBe("CLOSED");
  });
});

describe("canScanForAttendancePhase", () => {
  it("allows scan only when OPEN", () => {
    expect(canScanForAttendancePhase("OPEN")).toBe(true);
    expect(canScanForAttendancePhase("LOCKED")).toBe(false);
    expect(canScanForAttendancePhase("CLOSED")).toBe(false);
  });
});

describe("attendancePhaseLabel", () => {
  it("returns human labels", () => {
    expect(attendancePhaseLabel("OPEN")).toBe("Attendance open");
    expect(attendancePhaseLabel("LOCKED")).toBe("Attendance locked");
  });
});
