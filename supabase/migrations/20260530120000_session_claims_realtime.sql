-- Enable realtime for tutor session board refresh when admin/lecturer updates claims.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'session_claims'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_claims;
  END IF;
END $$;
