import type { ClaimCreationSource } from "#/lib/claim-creation-source";

export type ScheduledSessionForClaim = {
  id: string;
  module_id: string;
  tutor_id: string;
  starts_at: string;
  ends_at: string;
  venue_text: string | null;
  venue: { name: string } | null;
  series: { session_kind: string } | null;
};

export type ClaimSnapshot = {
  tutor_id: string;
  module_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  venue: string | null;
  session_kind: string;
  creation_source: ClaimCreationSource;
  source_scheduled_session_id: string;
};

export type ClaimFieldsForDiff = {
  session_date: string;
  start_time: string;
  end_time: string;
  hours: number | string | null;
  venue: string | null;
};

export type ClaimFieldMismatch =
  | "date"
  | "time"
  | "hours"
  | "venue";
