-- Session automation: incremental materialize metadata, claim origin, attendance lock, auto-submit, reminders.

-- ---------------------------------------------------------------------------
-- claim_creation_source
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_creation_source') THEN
    CREATE TYPE public.claim_creation_source AS ENUM (
      'SCHEDULE',
      'TUTOR_MANUAL',
      'IMPORT',
      'LECTURER_ONE_OFF'
    );
  END IF;
END $$;

ALTER TABLE public.schedule_series
  ADD COLUMN IF NOT EXISTS materialized_until timestamptz;

COMMENT ON COLUMN public.schedule_series.materialized_until IS
  'Latest occurrence end time written by incremental materialization.';

ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS creation_source public.claim_creation_source,
  ADD COLUMN IF NOT EXISTS attendance_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_submitted_at timestamptz;

COMMENT ON COLUMN public.session_claims.creation_source IS
  'How the claim was created: official schedule, tutor manual, import, or lecturer one-off series.';
COMMENT ON COLUMN public.session_claims.attendance_locked_at IS
  'When attendance edits and QR check-in were locked after session end.';
COMMENT ON COLUMN public.session_claims.auto_submitted_at IS
  'When the claim was submitted automatically by institution policy.';

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS auto_submit_claims boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_submit_requires_attendance boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.institutions.auto_submit_claims IS
  'When true, eligible DRAFT claims may be auto-submitted after session end.';
COMMENT ON COLUMN public.institutions.auto_submit_requires_attendance IS
  'When true, auto-submit requires attendance rows or register evidence.';

-- Backfill creation_source from existing linkage columns
UPDATE public.session_claims sc
SET creation_source = CASE
  WHEN sc.source_scheduled_session_id IS NOT NULL THEN 'SCHEDULE'::public.claim_creation_source
  WHEN sc.source_schedule_import_id IS NOT NULL THEN 'IMPORT'::public.claim_creation_source
  ELSE 'TUTOR_MANUAL'::public.claim_creation_source
END
WHERE sc.creation_source IS NULL;

ALTER TABLE public.session_claims
  ALTER COLUMN creation_source SET DEFAULT 'TUTOR_MANUAL'::public.claim_creation_source;

-- Notification types for session reminders
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_UPCOMING';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'CLAIM_DRAFT_REMINDER';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'CLAIM_PENDING_REMINDER';
