-- Structured session notes fields for tutor workspace
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS examples_used text,
  ADD COLUMN IF NOT EXISTS student_struggles text,
  ADD COLUMN IF NOT EXISTS revision_topics text;

COMMENT ON COLUMN public.session_claims.examples_used IS 'Specific problems or examples worked through during the session.';
COMMENT ON COLUMN public.session_claims.student_struggles IS 'Pain points or areas where the student showed difficulty.';
COMMENT ON COLUMN public.session_claims.revision_topics IS 'Items recommended for the student to review before next session.';
