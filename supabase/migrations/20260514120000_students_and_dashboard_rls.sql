-- Students roster + optional link on session claims; RLS for users self-read, notifications inbox.

-- ---------------------------------------------------------------------------
-- students (per institution directory)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  full_name character varying(255) NOT NULL,
  student_reference character varying(100),
  email character varying(255),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_institution_id ON public.students (institution_id);

COMMENT ON TABLE public.students IS 'Institution-scoped learner directory; tutors link via tutor_student_assignments.';

-- ---------------------------------------------------------------------------
-- tutor_student_assignments (roster: which students a tutor supports)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutor_student_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_student_assignments_tutor_student_key UNIQUE (tutor_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tutor_student_assignments_tutor ON public.tutor_student_assignments (tutor_id);

COMMENT ON TABLE public.tutor_student_assignments IS 'Tutor roster entries for dashboard “active students” and future claim linkage.';

-- ---------------------------------------------------------------------------
-- session_claims: optional student on a claim
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_claims_tutor_student
  ON public.session_claims (tutor_id, student_id);

-- ---------------------------------------------------------------------------
-- RLS: students
-- ---------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.students TO authenticated;

DROP POLICY IF EXISTS "students_select_same_institution" ON public.students;
CREATE POLICY "students_select_same_institution" ON public.students
  FOR SELECT TO authenticated
  USING (
    institution_id = (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "students_insert_same_institution" ON public.students;
CREATE POLICY "students_insert_same_institution" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id = (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "students_update_same_institution" ON public.students;
CREATE POLICY "students_update_same_institution" ON public.students
  FOR UPDATE TO authenticated
  USING (
    institution_id = (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id = (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: tutor_student_assignments
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutor_student_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tutor_student_assignments TO authenticated;

DROP POLICY IF EXISTS "tutor_student_assignments_select_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_select_own" ON public.tutor_student_assignments
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "tutor_student_assignments_insert_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_insert_own" ON public.tutor_student_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.students s
      INNER JOIN public.users u ON u.id = auth.uid()
      WHERE s.id = student_id
        AND s.institution_id = u.institution_id
    )
  );

DROP POLICY IF EXISTS "tutor_student_assignments_update_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_update_own" ON public.tutor_student_assignments
  FOR UPDATE TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.students s
      INNER JOIN public.users u ON u.id = auth.uid()
      WHERE s.id = student_id
        AND s.institution_id = u.institution_id
    )
  );

DROP POLICY IF EXISTS "tutor_student_assignments_delete_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_delete_own" ON public.tutor_student_assignments
  FOR DELETE TO authenticated
  USING (tutor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: public.users — self read (required for institution subqueries in other policies)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_self" ON public.users;
CREATE POLICY "users_select_self" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: notifications — recipient inbox
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_recipient_select" ON public.notifications;
CREATE POLICY "notifications_recipient_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_recipient_update" ON public.notifications;
CREATE POLICY "notifications_recipient_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());
