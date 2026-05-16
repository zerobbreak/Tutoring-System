export const APPROVAL_CLAIM_SELECT = `
  id,
  session_date,
  start_time,
  end_time,
  hours,
  venue,
  status,
  submitted_at,
  updated_at,
  frozen_at,
  notes,
  topics_covered,
  session_kind,
  attendance_present_count,
  attendance_expected_count,
  source_schedule_import_id,
  module:modules ( id, code, name ),
  tutor:users!session_claims_tutor_id_fkey ( id, full_name, email )
`;

export const QUEUE_LIMIT = 50;
export const RECENTLY_APPROVED_LIMIT = 15;
export const STALLED_DAYS = 7;

export const QUEUE_STATUSES = {
  awaitingAdmin: ["VERIFIED"] as const,
  disputed: ["DISPUTED"] as const,
  recentlyApproved: ["APPROVED"] as const,
  escalatedSource: ["VERIFIED", "DISPUTED", "PENDING_VERIFICATION"] as const,
};
