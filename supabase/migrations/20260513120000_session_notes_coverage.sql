-- Session-linked coverage fields for tutor notes (UI: /tutor/notes)
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS topics_covered text,
  ADD COLUMN IF NOT EXISTS coverage_validated_at timestamptz;

COMMENT ON COLUMN public.session_claims.topics_covered IS 'Tutor record of concepts or agenda items addressed in this session.';
COMMENT ON COLUMN public.session_claims.coverage_validated_at IS 'When the tutor confirmed topics_covered reflects what was taught.';

-- RLS: tutors read/update their own claims; read modules in their institution (for joins)
DROP POLICY IF EXISTS "session_claims_tutor_select" ON public.session_claims;
CREATE POLICY "session_claims_tutor_select" ON public.session_claims
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "session_claims_tutor_update" ON public.session_claims;
CREATE POLICY "session_claims_tutor_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

DROP POLICY IF EXISTS "modules_select_same_institution" ON public.modules;
CREATE POLICY "modules_select_same_institution" ON public.modules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.institution_id = modules.institution_id
    )
  );
