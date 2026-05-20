-- Tutor session request workflow: reason, review status, lecturer/admin feedback.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_request_status') THEN
    CREATE TYPE public.session_request_status AS ENUM (
      'PENDING',
      'CHANGES_REQUESTED',
      'REJECTED',
      'APPROVED'
    );
  END IF;
END $$;

ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS request_reason text,
  ADD COLUMN IF NOT EXISTS request_status public.session_request_status,
  ADD COLUMN IF NOT EXISTS review_feedback text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.session_claims.request_reason IS
  'Why the tutor requested this session (required for manual requests).';
COMMENT ON COLUMN public.session_claims.request_status IS
  'Approval state for tutor-requested manual sessions.';
COMMENT ON COLUMN public.session_claims.review_feedback IS
  'Reviewer feedback when suggesting changes or rejecting.';

-- Legacy admin-approved manual claims
UPDATE public.session_claims
SET request_status = 'APPROVED'::public.session_request_status
WHERE request_status IS NULL
  AND admin_creation_approved_at IS NOT NULL
  AND source_scheduled_session_id IS NULL
  AND source_schedule_import_id IS NULL;

-- Pending manual requests (awaiting review)
UPDATE public.session_claims
SET request_status = 'PENDING'::public.session_request_status
WHERE request_status IS NULL
  AND source_scheduled_session_id IS NULL
  AND source_schedule_import_id IS NULL;
