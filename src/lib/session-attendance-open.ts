import { parseISO } from "date-fns";
import {
  attendancePhaseLabel,
  canScanForAttendancePhase,
  getAttendancePhase,
  type AttendancePhaseInput,
} from "#/lib/attendance-phase";
import { qrWindowForScheduledSession } from "#/lib/session-qr-window";

export type ClaimAttendanceBoundsInput = AttendancePhaseInput;

/** Whether tutor card scanning should be enabled for this claim (mirrors server gate). */
export function canTutorScanAttendanceForClaim(
  claim: ClaimAttendanceBoundsInput,
  now: Date = new Date(),
): boolean {
  return canScanForAttendancePhase(getAttendancePhase(claim, now));
}

export function attendanceScanWindowLabel(
  claim: ClaimAttendanceBoundsInput,
  now: Date = new Date(),
): string | null {
  const phase = getAttendancePhase(claim, now);
  const phaseLabel = attendancePhaseLabel(phase);

  const bounds =
    claim.scheduled_starts_at && claim.scheduled_ends_at
      ? {
          startsAt: claim.scheduled_starts_at,
          endsAt: claim.scheduled_ends_at,
        }
      : claim.session_date && claim.start_time && claim.end_time
        ? {
            startsAt: `${claim.session_date}T${claim.start_time}`,
            endsAt: `${claim.session_date}T${claim.end_time}`,
          }
        : null;

  if (!bounds) {
    return phaseLabel;
  }

  const start = parseISO(bounds.startsAt);
  const end = parseISO(bounds.endsAt);
  const { validFrom, validUntil } = qrWindowForScheduledSession(bounds);

  if (phase === "OPEN") {
    return `${phaseLabel} — scan from ${validFrom.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} until ${validUntil.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (session ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  }

  return `${phaseLabel} — session ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
