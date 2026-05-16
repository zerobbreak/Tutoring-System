-- Fix conversation creation: INSERT RETURNING failed SELECT (participant-only) policy.
-- Allow adding any same-institution user as a participant (not only tutors).

DROP POLICY IF EXISTS "conversations_insert_same_institution" ON public.conversations;
CREATE POLICY "conversations_insert_same_institution" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "conversation_participants_insert" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      INNER JOIN public.conversations c ON c.id = conversation_participants.conversation_id
      WHERE u.id = conversation_participants.user_id
        AND u.institution_id IS NOT DISTINCT FROM c.institution_id
        AND c.institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
    )
  );
