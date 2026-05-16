-- Participant INSERT policy must not JOIN conversations under RLS: the creator
-- cannot SELECT the new row until they are a participant.

CREATE OR REPLACE FUNCTION public.can_insert_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.conversations c
      INNER JOIN public.users target ON target.id = p_user_id
      INNER JOIN public.users creator ON creator.id = auth.uid()
      WHERE c.id = p_conversation_id
        AND target.institution_id IS NOT DISTINCT FROM c.institution_id
        AND creator.institution_id IS NOT DISTINCT FROM c.institution_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_insert_conversation_participant(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "conversation_participants_insert" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_insert_conversation_participant(conversation_id, user_id)
  );
