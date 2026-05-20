import { sessionBoundsLocal } from "#/lib/session-kanban-column";

export type SessionClaimTimingFields = {
  session_date: string;
  start_time: string | null;
  end_time: string | null;
};

/** True when the session wall-clock end is before `now`. */
export function isSessionEnded(
  claim: SessionClaimTimingFields,
  now: Date = new Date(),
): boolean {
  const start = claim.start_time ?? "09:00";
  const end = claim.end_time ?? "10:00";
  const { end: endInstant } = sessionBoundsLocal(
    claim.session_date,
    start,
    end,
  );
  return endInstant.getTime() < now.getTime();
}

/**
 * Zero students recorded with register/evidence on file — tutor must explain or
 * the claim is escalated on submit.
 */
export function isNoShowWithEvidence(input: {
  attendancePresentCount: number | null;
  evidenceCount: number;
}): boolean {
  if (input.evidenceCount <= 0) return false;
  const present = input.attendancePresentCount ?? 0;
  return present <= 0;
}

export function normalizeNoShowReason(value: string | undefined): string {
  return (value ?? "").trim();
}
