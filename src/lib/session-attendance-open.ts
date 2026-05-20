import { parseISO } from "date-fns";
import {
  isAttendanceLocked,
  isWithinQrWindow,
  type SessionTimeBounds,
} from "#/lib/session-qr-window";

export type ClaimAttendanceBoundsInput = {
  attendance_locked_at: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  scheduled_starts_at?: string | null;
  scheduled_ends_at?: string | null;
};

function claimTimeBounds(claim: ClaimAttendanceBoundsInput): SessionTimeBounds | null {
  if (claim.scheduled_starts_at && claim.scheduled_ends_at) {
    return {
      startsAt: claim.scheduled_starts_at,
      endsAt: claim.scheduled_ends_at,
    };
  }
  if (claim.session_date && claim.start_time && claim.end_time) {
    return {
      startsAt: `${claim.session_date}T${claim.start_time}`,
      endsAt: `${claim.session_date}T${claim.end_time}`,
    };
  }
  return null;
}

/** Whether tutor card scanning should be enabled for this claim (mirrors server gate). */
export function canTutorScanAttendanceForClaim(
  claim: ClaimAttendanceBoundsInput,
  now: Date = new Date(),
): boolean {
  if (claim.attendance_locked_at) return false;
  const bounds = claimTimeBounds(claim);
  if (!bounds) return true;
  if (isAttendanceLocked(bounds, now)) return false;
  return isWithinQrWindow(bounds, now);
}

export function attendanceScanWindowLabel(
  claim: ClaimAttendanceBoundsInput,
): string | null {
  const bounds = claimTimeBounds(claim);
  if (!bounds) return null;
  const start = parseISO(bounds.startsAt);
  const end = parseISO(bounds.endsAt);
  return `Scanning open from 15 min before start until 30 min after end (${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
}
