-- Private lecturer feedback on verified session claims (tutor / lecturer / admin only).

DO $$ BEGIN
  CREATE TYPE public.private_feedback_category AS ENUM (
    'PREPAREDNESS',
    'STUDENT_ENGAGEMENT',
    'ATTENDANCE_MANAGEMENT',
    'PROFESSIONALISM',
    'SESSION_EFFECTIVENESS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.private_session_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.session_claims (id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  category_ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT private_session_feedback_claim_author_unique UNIQUE (claim_id, author_id),
  CONSTRAINT private_session_feedback_has_content CHECK (
    btrim(COALESCE(note, '')) <> ''
    OR category_ratings <> '{}'::jsonb
  )
);

CREATE INDEX IF NOT EXISTS idx_private_session_feedback_claim
  ON public.private_session_feedback (claim_id);

CREATE INDEX IF NOT EXISTS idx_private_session_feedback_tutor
  ON public.private_session_feedback (tutor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_session_feedback_institution
  ON public.private_session_feedback (institution_id);

COMMENT ON TABLE public.private_session_feedback IS
  'Optional private developmental feedback after session verification; not public.';

ALTER TABLE public.private_session_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "private_session_feedback_lecturer_select" ON public.private_session_feedback;
CREATE POLICY "private_session_feedback_lecturer_select" ON public.private_session_feedback
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  );

DROP POLICY IF EXISTS "private_session_feedback_lecturer_insert" ON public.private_session_feedback;
CREATE POLICY "private_session_feedback_lecturer_insert" ON public.private_session_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  );

DROP POLICY IF EXISTS "private_session_feedback_lecturer_update" ON public.private_session_feedback;
CREATE POLICY "private_session_feedback_lecturer_update" ON public.private_session_feedback
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  )
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  );

DROP POLICY IF EXISTS "private_session_feedback_tutor_select" ON public.private_session_feedback;
CREATE POLICY "private_session_feedback_tutor_select" ON public.private_session_feedback
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "private_session_feedback_admin_select" ON public.private_session_feedback;
CREATE POLICY "private_session_feedback_admin_select" ON public.private_session_feedback
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = (
      SELECT u.institution_id
      FROM public.users u
      WHERE u.id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.private_session_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.private_session_feedback TO service_role;
