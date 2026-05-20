import { addMinutes, isAfter, isBefore, parseISO } from "date-fns";

export const QR_BUFFER_BEFORE_MINUTES = 15;
export const QR_BUFFER_AFTER_MINUTES = 30;
export const ATTENDANCE_LOCK_GRACE_MINUTES = 30;

export type SessionTimeBounds = {
  startsAt: string;
  endsAt: string;
};

export function qrWindowForScheduledSession(bounds: SessionTimeBounds): {
  validFrom: Date;
  validUntil: Date;
} {
  const startsAt = parseISO(bounds.startsAt);
  const endsAt = parseISO(bounds.endsAt);
  return {
    validFrom: addMinutes(startsAt, -QR_BUFFER_BEFORE_MINUTES),
    validUntil: addMinutes(endsAt, QR_BUFFER_AFTER_MINUTES),
  };
}

export function isWithinQrWindow(
  bounds: SessionTimeBounds,
  now: Date = new Date(),
): boolean {
  const { validFrom, validUntil } = qrWindowForScheduledSession(bounds);
  return !isBefore(now, validFrom) && !isAfter(now, validUntil);
}

export function isAttendanceLocked(
  bounds: SessionTimeBounds,
  now: Date = new Date(),
): boolean {
  const endsAt = parseISO(bounds.endsAt);
  return isAfter(now, addMinutes(endsAt, ATTENDANCE_LOCK_GRACE_MINUTES));
}
