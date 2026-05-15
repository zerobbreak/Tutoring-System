export const VERIFICATION_CLAIM_SELECT = `
  id,
  session_date,
  start_time,
  end_time,
  hours,
  venue,
  status,
  submitted_at,
  updated_at,
  notes,
  topics_covered,
  session_kind,
  attendance_present_count,
  attendance_expected_count,
  source_schedule_import_id,
  module:modules ( id, code, name ),
  tutor:users!session_claims_tutor_id_fkey ( full_name, email )
`;

export const RECENTLY_VERIFIED_LIMIT = 15;
export const QUEUE_STATUSES = {
  pending: ["PENDING_VERIFICATION"] as const,
  disputed: ["DISPUTED"] as const,
  recentlyVerified: ["VERIFIED", "APPROVED"] as const,
};
