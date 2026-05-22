-- Tutors can submit a zero-attendance claim without an explanation; the app
-- freezes/escalates it and records that workflow event under the tutor actor.
DROP POLICY IF EXISTS "verification_actions_tutor_insert" ON public.verification_actions;
CREATE POLICY "verification_actions_tutor_insert" ON public.verification_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()::uuid
    AND action_type IN (
      'TUTOR_SUBMITTED',
      'TUTOR_RESUBMITTED',
      'NO_SHOW_ESCALATED'
    )
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = verification_actions.claim_id
        AND sc.tutor_id = auth.uid()::uuid
    )
  );
