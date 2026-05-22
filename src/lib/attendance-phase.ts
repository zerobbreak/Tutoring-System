import {
  isAttendanceLocked,
  isWithinQrWindow,
  type SessionTimeBounds,
} from "#/lib/session-qr-window";

export type AttendancePhase =
  | "CLOSED"
  | "OPEN"
  | "LOCKED"
  | "FINALIZED";

export type AttendancePhaseInput = {
  attendance_locked_at: string | null;
  frozen_at?: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  scheduled_starts_at?: string | null;
  scheduled_ends_at?: string | null;
};

function claimTimeBounds(input: AttendancePhaseInput): SessionTimeBounds | null {
  if (input.scheduled_starts_at && input.scheduled_ends_at) {
    return {
      startsAt: input.scheduled_starts_at,
      endsAt: input.scheduled_ends_at,
    };
  }
  if (input.session_date && input.start_time && input.end_time) {
    return {
      startsAt: `${input.session_date}T${input.start_time}`,
      endsAt: `${input.session_date}T${input.end_time}`,
    };
  }
  return null;
}

/** Session-level attendance lifecycle (distinct from per-student PRESENT/LATE rows). */
export function getAttendancePhase(
  input: AttendancePhaseInput,
  now: Date = new Date(),
): AttendancePhase {
  if (input.frozen_at) {
    return "FINALIZED";
  }
  if (input.attendance_locked_at) {
    return "LOCKED";
  }

  const bounds = claimTimeBounds(input);
  if (!bounds) {
    return "OPEN";
  }

  if (isAttendanceLocked(bounds, now)) {
    return "LOCKED";
  }

  if (isWithinQrWindow(bounds, now)) {
    return "OPEN";
  }

  return "CLOSED";
}

export function attendancePhaseLabel(phase: AttendancePhase): string {
  switch (phase) {
    case "OPEN":
      return "Attendance open";
    case "CLOSED":
      return "Attendance closed";
    case "LOCKED":
      return "Attendance locked";
    case "FINALIZED":
      return "Attendance finalized";
    default:
      return "Attendance";
  }
}

export function canScanForAttendancePhase(phase: AttendancePhase): boolean {
  return phase === "OPEN";
}
