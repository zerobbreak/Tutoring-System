import type { ClaimFieldMismatch, ClaimFieldsForDiff, ClaimSnapshot } from "./types";

export function diffClaimFromSnapshot(
  claim: ClaimFieldsForDiff,
  snapshot: Pick<
    ClaimSnapshot,
    "session_date" | "start_time" | "end_time" | "hours" | "venue"
  >,
): ClaimFieldMismatch[] {
  const mismatches: ClaimFieldMismatch[] = [];

  if (claim.session_date !== snapshot.session_date) {
    mismatches.push("date");
  }
  if (
    claim.start_time !== snapshot.start_time ||
    claim.end_time !== snapshot.end_time
  ) {
    mismatches.push("time");
  }

  const claimHours = Number(claim.hours);
  if (Math.abs(claimHours - snapshot.hours) > 0.01) {
    mismatches.push("hours");
  }

  const claimVenue = claim.venue?.trim() || null;
  const scheduledVenue = snapshot.venue;
  if (scheduledVenue && claimVenue && scheduledVenue !== claimVenue) {
    mismatches.push("venue");
  }

  return mismatches;
}
