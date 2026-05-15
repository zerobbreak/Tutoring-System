export const LOW_ATTENDANCE_RATIO = 0.6;
export const LOW_ATTENDANCE_MIN_SESSIONS = 2;
export const ALERT_LOOKBACK_DAYS = 30;
export const MISSING_REGISTER_LOOKBACK_DAYS = 14;
export const ACTIVITY_LIMIT = 12;
export const PENDING_QUEUE_LIMIT = 8;
export const RECENT_CLAIMS_LIMIT = 8;

export const PENDING_CLAIMS_SELECT = `
  id,
  session_date,
  start_time,
  hours,
  status,
  submitted_at,
  attendance_present_count,
  attendance_expected_count,
  module:modules ( code, name ),
  tutor:users!session_claims_tutor_id_fkey ( id, full_name, email )
`;

export const RECENT_CLAIMS_SELECT = `
  id,
  session_date,
  start_time,
  hours,
  status,
  updated_at,
  module:modules ( code, name )
`;
