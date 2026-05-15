export const SCHEDULED_SESSION_SELECT = `
  id,
  series_id,
  module_id,
  tutor_id,
  starts_at,
  ends_at,
  venue_id,
  venue_text,
  status,
  module:modules!scheduled_sessions_module_id_fkey (
    id,
    code,
    name
  ),
  tutor:users!scheduled_sessions_tutor_id_fkey (
    id,
    full_name
  ),
  series:schedule_series!scheduled_sessions_series_id_fkey (
    id,
    title,
    session_kind
  ),
  venue:venues (
    id,
    name
  )
`;

export const SERIES_SELECT = `
  id,
  module_id,
  title,
  session_kind,
  tutor_id,
  venue_id,
  venue_text,
  timezone,
  dtstart,
  duration_minutes,
  recurrence_json,
  status,
  published_at,
  module:modules!schedule_series_module_id_fkey (
    code
  ),
  tutor:users!schedule_series_tutor_id_fkey (
    full_name
  )
`;
