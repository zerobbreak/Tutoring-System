-- Lecturer tutor directory + messaging write policies for DIRECT conversations.

-- ---------------------------------------------------------------------------
-- users: lecturers may browse institution tutors (assignment picker)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_tutors_same_institution_for_lecturer" ON public.users;
CREATE POLICY "users_select_tutors_same_institution_for_lecturer" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'TUTOR'::public.user_role
    AND public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- conversations: participants may create conversations in their institution
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "conversations_insert_same_institution" ON public.conversations;
CREATE POLICY "conversations_insert_same_institution" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "conversations_update_participant" ON public.conversations;
CREATE POLICY "conversations_update_participant" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(id))
  WITH CHECK (public.is_conversation_participant(id));

-- ---------------------------------------------------------------------------
-- conversation_participants: creator adds self + same-institution users
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "conversation_participants_insert" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_same_institution_as_auth(user_id)
  );
