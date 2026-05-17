-- Soft delete for compliance: claims, scheduled sessions, attendance, draft series.
-- Rows are retained; default visibility excludes deleted_at IS NOT NULL.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

ALTER TABLE public.scheduled_sessions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

ALTER TABLE public.session_attendance
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

ALTER TABLE public.schedule_series
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

COMMENT ON COLUMN public.session_claims.deleted_at IS
  'Soft delete tombstone; row retained for audit and disputes.';
COMMENT ON COLUMN public.scheduled_sessions.deleted_at IS
  'Soft delete tombstone; prefer status=CANCELLED for operational cancel.';
COMMENT ON COLUMN public.session_attendance.deleted_at IS
  'Soft delete tombstone; attendance history retained.';

-- ---------------------------------------------------------------------------
-- Indexes (active rows)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_session_claims_active
  ON public.session_claims (module_id, session_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_active_series
  ON public.scheduled_sessions (series_id, starts_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_session_attendance_active_session
  ON public.session_attendance (session_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_series_active_institution
  ON public.schedule_series (institution_id)
  WHERE deleted_at IS NULL AND institution_id IS NOT NULL;

-- Allow re-check-in after soft-deleted attendance row
ALTER TABLE public.session_attendance
  DROP CONSTRAINT IF EXISTS session_attendance_session_id_student_id_key;

DROP INDEX IF EXISTS public.session_attendance_session_id_student_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_attendance_active_unique
  ON public.session_attendance (session_id, student_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- session_claims RLS (hide soft-deleted)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_claims_tutor_select" ON public.session_claims;
CREATE POLICY "session_claims_tutor_select" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  );

DROP POLICY IF EXISTS "session_claims_tutor_update" ON public.session_claims;
CREATE POLICY "session_claims_tutor_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  )
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  );

DROP POLICY IF EXISTS "session_claims_lecturer_select_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_select_own_modules" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_claims_lecturer_update_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_update_own_modules" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND public.auth_user_has_platform_access()
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND public.auth_user_has_platform_access()
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_claims_admin_select" ON public.session_claims;
CREATE POLICY "session_claims_admin_select" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "session_claims_admin_update" ON public.session_claims;
CREATE POLICY "session_claims_admin_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- ---------------------------------------------------------------------------
-- scheduled_sessions RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "scheduled_sessions_tutor_select" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_tutor_select" ON public.scheduled_sessions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.schedule_series ss
      WHERE ss.id = scheduled_sessions.series_id
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
        AND ss.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "scheduled_sessions_lecturer_all" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_lecturer_all" ON public.scheduled_sessions
  FOR ALL TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_lecturer_for_module(module_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND public.is_lecturer_for_module(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_tutor_update_own" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_tutor_update_own" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.schedule_series ss
      WHERE ss.id = scheduled_sessions.series_id
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
        AND ss.deleted_at IS NULL
    )
  )
  WITH CHECK (tutor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- session_attendance: no hard DELETE for tutors
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tutors_manage_session_attendance" ON public.session_attendance;
CREATE POLICY "session_attendance_tutor_select" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );

CREATE POLICY "session_attendance_tutor_insert" ON public.session_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );

CREATE POLICY "session_attendance_tutor_update" ON public.session_attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );

-- Tutors may restore soft-deleted attendance on their sessions (check-in again)
CREATE POLICY "session_attendance_tutor_restore" ON public.session_attendance
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "session_attendance_lecturer_select" ON public.session_attendance;
CREATE POLICY "session_attendance_lecturer_select" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      JOIN public.modules m ON m.id = sc.module_id
      WHERE sc.id = session_attendance.session_id
        AND sc.deleted_at IS NULL
        AND m.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_attendance_admin_select" ON public.session_attendance;
CREATE POLICY "session_attendance_admin_select" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(session_id)
  );

-- Admin scheduling: hide soft-deleted; disallow hard DELETE on sessions
DROP POLICY IF EXISTS "scheduled_sessions_admin_select" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_select" ON public.scheduled_sessions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_update" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_update" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_delete" ON public.scheduled_sessions;

DROP POLICY IF EXISTS "schedule_series_admin_select" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_select" ON public.schedule_series
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );
