-- Admin sessions monitoring: query indexes for institution-wide lists and attendance scans.
-- Attendance row access for admins uses session_attendance_admin_select (no students/users join).

CREATE INDEX IF NOT EXISTS idx_session_claims_module_session_date
  ON public.session_claims (module_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_session_attendance_session_id
  ON public.session_attendance (session_id);

CREATE INDEX IF NOT EXISTS idx_session_attendance_student_check_in
  ON public.session_attendance (student_id, check_in_time DESC);
