-- Lecturers can read session claims for modules they own (dashboard / verification).
DROP POLICY IF EXISTS "session_claims_lecturer_select_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_select_own_modules" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  );
