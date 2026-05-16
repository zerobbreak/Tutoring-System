-- Institution-scoped read access for ADMIN and SUPER_ADMIN dashboard operations.

CREATE OR REPLACE FUNCTION public.auth_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role IN ('ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role)
  FROM public.users
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_module_in_auth_institution(p_module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.modules m
    WHERE m.id = p_module_id
      AND m.institution_id = public.get_auth_user_institution_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_claim_in_auth_institution(p_claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_claims sc
    INNER JOIN public.modules m ON m.id = sc.module_id
    WHERE sc.id = p_claim_id
      AND m.institution_id = public.get_auth_user_institution_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_module_in_auth_institution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_claim_in_auth_institution(uuid) TO authenticated;

-- session_claims
DROP POLICY IF EXISTS "session_claims_admin_select" ON public.session_claims;
CREATE POLICY "session_claims_admin_select" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- disputes
DROP POLICY IF EXISTS "disputes_admin_select" ON public.disputes;
CREATE POLICY "disputes_admin_select" ON public.disputes
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

-- verification_actions
DROP POLICY IF EXISTS "verification_actions_admin_select" ON public.verification_actions;
CREATE POLICY "verification_actions_admin_select" ON public.verification_actions
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

-- audit_logs
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- attendance_evidence
DROP POLICY IF EXISTS "attendance_evidence_admin_select" ON public.attendance_evidence;
CREATE POLICY "attendance_evidence_admin_select" ON public.attendance_evidence
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

-- session_attendance
DROP POLICY IF EXISTS "session_attendance_admin_select" ON public.session_attendance;
CREATE POLICY "session_attendance_admin_select" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(session_id)
  );

-- users (tutors and lecturers in same institution)
DROP POLICY IF EXISTS "users_admin_select_institution" ON public.users;
CREATE POLICY "users_admin_select_institution" ON public.users
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- tutor_assignments
DROP POLICY IF EXISTS "tutor_assignments_admin_select" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_admin_select" ON public.tutor_assignments
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- scheduled_sessions
DROP POLICY IF EXISTS "scheduled_sessions_admin_select" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_select" ON public.scheduled_sessions
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- schedule_series
DROP POLICY IF EXISTS "schedule_series_admin_select" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_select" ON public.schedule_series
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- schedule_change_requests
DROP POLICY IF EXISTS "schedule_change_requests_admin_select" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_admin_select" ON public.schedule_change_requests
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      WHERE s.id = schedule_change_requests.scheduled_session_id
        AND public.is_module_in_auth_institution(s.module_id)
    )
  );
