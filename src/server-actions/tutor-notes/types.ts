import type { ClaimStatus } from "#/lib/session-claim-display";

/** Shared fields lecturers read; examples_used / notes are legacy, read-only. */
export type SessionSharedNotes = {
  topics_covered: string | null;
  student_struggles: string | null;
  revision_topics: string | null;
};

export type TutorNotesClaimDTO = SessionSharedNotes & {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: ClaimStatus;
  examples_used: string | null;
  notes: string | null;
  private_note: string | null;
  seen_by_lecturer_at: string | null;
  module: { id: string; code: string; name: string } | null;
};

export type PreviousSessionNotesDTO = {
  claim_id: string;
  session_date: string;
  student_struggles: string | null;
  revision_topics: string | null;
};

export type SessionNotesDTO = TutorNotesClaimDTO & {
  /** Shared notes lock once the claim leaves DRAFT (reopen to edit again). */
  shared_editable: boolean;
  previous: PreviousSessionNotesDTO | null;
};
