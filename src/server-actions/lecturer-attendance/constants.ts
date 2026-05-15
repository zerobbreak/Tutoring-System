export const TREND_LOOKBACK_DAYS = 90;
export const ALERT_LOOKBACK_DAYS = 30;
export const MISSING_REGISTER_LOOKBACK_DAYS = 14;
export const LOW_SESSION_RATIO = 0.6;
export const LOW_ATTENDANCE_MIN_SESSIONS = 2;
export const LOW_ATTENDANCE_RATIO = 0.6;

export const CLAIM_ATTENDANCE_SELECT = `
  id,
  module_id,
  session_date,
  start_time,
  end_time,
  status,
  attendance_present_count,
  attendance_expected_count,
  qr_expires_at,
  module:modules ( id, code, name ),
  tutor:users!session_claims_tutor_id_fkey ( id, full_name )
`;
