-- Tutor sessions workspace: lecturer visibility, attendance evidence RLS, headcounts,
-- tutor_assignments read, modules→users FK for PostgREST embeds, attendance register storage.

-- ---------------------------------------------------------------------------
-- modules.lecturer_id → public.users (for nested lecturer selects)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.modules
    ADD CONSTRAINT modules_lecturer_id_fkey
    FOREIGN KEY (lecturer_id) REFERENCES public.users (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- session_claims: optional attendance headcounts (tutor-maintained)
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS attendance_present_count integer,
  ADD COLUMN IF NOT EXISTS attendance_expected_count integer;

COMMENT ON COLUMN public.session_claims.attendance_present_count IS
  'Tutor-entered count of learners present; optional until register workflow exists.';
COMMENT ON COLUMN public.session_claims.attendance_expected_count IS
  'Expected roster size for progress UI; optional.';

-- ---------------------------------------------------------------------------
-- RLS: tutors can read lecturers in the same institution (directory)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_lecturers_same_institution" ON public.users;
CREATE POLICY "users_select_lecturers_same_institution" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'LECTURER'::public.user_role
    AND institution_id = (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: attendance_evidence for own session claims
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_evidence_tutor_select" ON public.attendance_evidence;
CREATE POLICY "attendance_evidence_tutor_select" ON public.attendance_evidence
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = attendance_evidence.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attendance_evidence_tutor_insert" ON public.attendance_evidence;
CREATE POLICY "attendance_evidence_tutor_insert" ON public.attendance_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = attendance_evidence.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attendance_evidence_tutor_delete" ON public.attendance_evidence;
CREATE POLICY "attendance_evidence_tutor_delete" ON public.attendance_evidence
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = attendance_evidence.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: tutor_assignments — read own rows (module picker)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tutor_assignments_select_own" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_select_own" ON public.tutor_assignments
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for register uploads
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance_registers', 'attendance_registers', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "attendance_registers_select_own" ON storage.objects;
CREATE POLICY "attendance_registers_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance_registers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "attendance_registers_insert_own" ON storage.objects;
CREATE POLICY "attendance_registers_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance_registers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "attendance_registers_update_own" ON storage.objects;
CREATE POLICY "attendance_registers_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attendance_registers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'attendance_registers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "attendance_registers_delete_own" ON storage.objects;
CREATE POLICY "attendance_registers_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attendance_registers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
