-- Admin scheduling engine: term linkage, institution settings, conflict indexes, admin write RLS.

-- ---------------------------------------------------------------------------
-- institutions.scheduling_settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS scheduling_settings jsonb NOT NULL
  DEFAULT '{"max_tutor_hours_per_week":20}'::jsonb;

COMMENT ON COLUMN public.institutions.scheduling_settings IS
  'Institution scheduling policy; max_tutor_hours_per_week used for overload detection.';

-- ---------------------------------------------------------------------------
-- modules.academic_term_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS academic_term_id uuid
  REFERENCES public.academic_terms (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_modules_academic_term_id
  ON public.modules (academic_term_id)
  WHERE academic_term_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- schedule_series: term + institution scope
-- ---------------------------------------------------------------------------
ALTER TABLE public.schedule_series
  ADD COLUMN IF NOT EXISTS academic_term_id uuid
  REFERENCES public.academic_terms (id) ON DELETE SET NULL;

ALTER TABLE public.schedule_series
  ADD COLUMN IF NOT EXISTS institution_id uuid
  REFERENCES public.institutions (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_schedule_series_academic_term_id
  ON public.schedule_series (academic_term_id)
  WHERE academic_term_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_series_institution_id
  ON public.schedule_series (institution_id);

UPDATE public.schedule_series ss
SET institution_id = m.institution_id
FROM public.modules m
WHERE m.id = ss.module_id
  AND ss.institution_id IS NULL;

-- ---------------------------------------------------------------------------
-- Conflict scan indexes on scheduled_sessions
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_venue_scheduled
  ON public.scheduled_sessions (venue_id, starts_at)
  WHERE status = 'SCHEDULED'::public.scheduled_session_status
    AND venue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_tutor_scheduled_range
  ON public.scheduled_sessions (tutor_id, starts_at, ends_at)
  WHERE status = 'SCHEDULED'::public.scheduled_session_status;

-- ---------------------------------------------------------------------------
-- Helper: series in admin institution
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_series_in_auth_institution(p_series_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.schedule_series ss
    INNER JOIN public.modules m ON m.id = ss.module_id
    WHERE ss.id = p_series_id
      AND m.institution_id = public.get_auth_user_institution_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_series_in_auth_institution(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: schedule_series (admin write)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "schedule_series_admin_insert" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_insert" ON public.schedule_series
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = tutor_id
        AND u.role = 'TUTOR'::public.user_role
        AND u.institution_id = public.get_auth_user_institution_id()
    )
  );

DROP POLICY IF EXISTS "schedule_series_admin_update" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_update" ON public.schedule_series
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "schedule_series_admin_delete" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_delete" ON public.schedule_series
  FOR DELETE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: scheduled_sessions (admin write)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "scheduled_sessions_admin_insert" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_insert" ON public.scheduled_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_update" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_update" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_delete" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_delete" ON public.scheduled_sessions
  FOR DELETE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: schedule_series_exceptions (admin write)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "schedule_series_exceptions_admin_all" ON public.schedule_series_exceptions;
CREATE POLICY "schedule_series_exceptions_admin_all" ON public.schedule_series_exceptions
  FOR ALL TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_series_in_auth_institution(series_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_series_in_auth_institution(series_id)
    AND created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- RLS: tutor_assignments (admin write)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tutor_assignments_admin_insert" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_admin_insert" ON public.tutor_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = tutor_id AND u.role = 'TUTOR'::public.user_role
    )
  );

DROP POLICY IF EXISTS "tutor_assignments_admin_update" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_admin_update" ON public.tutor_assignments
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
  );

DROP POLICY IF EXISTS "tutor_assignments_admin_delete" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_admin_delete" ON public.tutor_assignments
  FOR DELETE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: schedule_change_requests (admin review)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "schedule_change_requests_admin_update" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_admin_update" ON public.schedule_change_requests
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      WHERE s.id = schedule_change_requests.scheduled_session_id
        AND public.is_module_in_auth_institution(s.module_id)
    )
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      WHERE s.id = schedule_change_requests.scheduled_session_id
        AND public.is_module_in_auth_institution(s.module_id)
    )
  );

-- academic_terms: lecturers read current institution terms (for schedule UI)
DROP POLICY IF EXISTS "academic_terms_institution_select" ON public.academic_terms;
CREATE POLICY "academic_terms_institution_select" ON public.academic_terms
  FOR SELECT TO authenticated
  USING (
    institution_id = public.get_auth_user_institution_id()
  );
