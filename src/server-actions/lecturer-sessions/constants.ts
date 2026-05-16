export const LECTURER_SESSION_CLAIM_SELECT = `
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
  examples_used,
  student_struggles,
  revision_topics,
  session_kind,
  attendance_present_count,
  attendance_expected_count,
  qr_token,
  qr_expires_at,
  source_schedule_import_id,
  source_scheduled_session_id,
  module:modules ( id, code, name ),
  tutor:users!session_claims_tutor_id_fkey ( id, full_name, email )
`;

export const CANCELLED_SESSION_SELECT = `
  id,
  starts_at,
  ends_at,
  venue_text,
  status,
  module:modules ( id, code, name ),
  tutor:users!scheduled_sessions_tutor_id_fkey ( full_name ),
  series:schedule_series ( title )
`;
