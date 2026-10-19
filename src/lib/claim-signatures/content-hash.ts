/** Claim columns covered by a signature; status/timestamps are excluded on purpose. */
export const SIGNED_CLAIM_COLUMNS =
  "id, tutor_id, module_id, session_date, start_time, end_time, hours, venue, attendance_present_count, attendance_expected_count, topics_covered, student_struggles, revision_topics";

export type SignedClaimContent = {
  id: string;
  tutor_id: string;
  module_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number | string | null;
  venue: string | null;
  attendance_present_count: number | null;
  attendance_expected_count: number | null;
  topics_covered: string | null;
  student_struggles: string | null;
  revision_topics: string | null;
};

/**
 * SHA-256 (hex) over a canonical JSON of the claim content and its evidence
 * files. Same content always gives the same hash; any edit changes it.
 */
export async function claimContentHash(
  claim: SignedClaimContent,
  evidenceIds: string[],
): Promise<string> {
  const hours = claim.hours == null ? null : Number(claim.hours);
  const canonical = JSON.stringify([
    claim.id,
    claim.tutor_id,
    claim.module_id,
    claim.session_date,
    claim.start_time,
    claim.end_time,
    Number.isFinite(hours) ? hours : null,
    claim.venue,
    claim.attendance_present_count,
    claim.attendance_expected_count,
    claim.topics_covered,
    claim.student_struggles,
    claim.revision_topics,
    [...evidenceIds].sort(),
  ]);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
