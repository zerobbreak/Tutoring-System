-- Messaging enhancements: attachments, unread RPC, full-text search indexes.

-- ---------------------------------------------------------------------------
-- message_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id
  ON public.message_attachments (message_id);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_attachments_select_participant" ON public.message_attachments;
CREATE POLICY "message_attachments_select_participant" ON public.message_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "message_attachments_insert_participant" ON public.message_attachments;
CREATE POLICY "message_attachments_insert_participant" ON public.message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND m.sender_id = auth.uid()
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

GRANT SELECT, INSERT ON TABLE public.message_attachments TO authenticated;
GRANT ALL ON TABLE public.message_attachments TO service_role;

-- ---------------------------------------------------------------------------
-- Storage: message_attachments bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('message_attachments', 'message_attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "message_attachments_storage_select" ON storage.objects;
CREATE POLICY "message_attachments_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'message_attachments'
    AND public.is_conversation_participant(
      (split_part(name, '/', 1))::uuid
    )
  );

DROP POLICY IF EXISTS "message_attachments_storage_insert" ON storage.objects;
CREATE POLICY "message_attachments_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message_attachments'
    AND public.is_conversation_participant(
      (split_part(name, '/', 1))::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- Unread counts RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.messaging_unread_counts(p_user_id uuid)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.conversation_id,
    COUNT(*)::bigint AS unread_count
  FROM public.messages m
  INNER JOIN public.conversation_participants cp
    ON cp.conversation_id = m.conversation_id
    AND cp.user_id = p_user_id
  WHERE m.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
  GROUP BY m.conversation_id;
$$;

GRANT EXECUTE ON FUNCTION public.messaging_unread_counts(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Full-text search (pg_trgm)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
  ON public.messages USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_conversations_title_trgm
  ON public.conversations USING gin (title gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.messaging_search(
  p_user_id uuid,
  p_query text,
  p_conversation_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30
)
RETURNS TABLE(
  message_id uuid,
  conversation_id uuid,
  content text,
  created_at timestamptz,
  sender_id uuid,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id AS message_id,
    m.conversation_id,
    m.content,
    m.created_at,
    m.sender_id,
    similarity(m.content, p_query) AS rank
  FROM public.messages m
  INNER JOIN public.conversation_participants cp
    ON cp.conversation_id = m.conversation_id
    AND cp.user_id = p_user_id
  WHERE m.content ILIKE '%' || p_query || '%'
    AND (p_conversation_id IS NULL OR m.conversation_id = p_conversation_id)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.messaging_search(uuid, text, uuid, integer) TO authenticated;
