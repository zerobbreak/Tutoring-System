-- Link session_claims to tutor timetable imports (lazy "ensure claim" from calendar UI).

ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS source_schedule_import_id uuid
    REFERENCES public.tutor_schedule_imports (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_event_fingerprint text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS session_kind text;

COMMENT ON COLUMN public.session_claims.source_schedule_import_id IS
  'When set, this claim was created from a row in tutor_schedule_imports.parse_result.';
COMMENT ON COLUMN public.session_claims.source_event_fingerprint IS
  'Stable hash key for the import row (tutor_id + import + fingerprint unique when import is set).';
COMMENT ON COLUMN public.session_claims.session_kind IS
  'Normalized slot kind from spreadsheet (e.g. tutorial, consultation); optional display/filter.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_claims_import_event_unique
  ON public.session_claims (tutor_id, source_schedule_import_id, source_event_fingerprint)
  WHERE source_schedule_import_id IS NOT NULL
    AND source_event_fingerprint <> '';

CREATE INDEX IF NOT EXISTS idx_session_claims_source_import
  ON public.session_claims (source_schedule_import_id)
  WHERE source_schedule_import_id IS NOT NULL;

-- Tutors may create their own claims (e.g. from schedule → notes flow).
DROP POLICY IF EXISTS "session_claims_tutor_insert_own" ON public.session_claims;
CREATE POLICY "session_claims_tutor_insert_own" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND (
      source_schedule_import_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.tutor_schedule_imports i
        WHERE i.id = source_schedule_import_id
          AND i.tutor_id = auth.uid()
      )
    )
  );
