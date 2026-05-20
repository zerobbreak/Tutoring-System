-- Allow tutors to append workflow events on their own claims (submit / resubmit).
DROP POLICY IF EXISTS "verification_actions_tutor_insert" ON public.verification_actions;
CREATE POLICY "verification_actions_tutor_insert" ON public.verification_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND action_type IN ('TUTOR_SUBMITTED', 'TUTOR_RESUBMITTED')
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = verification_actions.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );
