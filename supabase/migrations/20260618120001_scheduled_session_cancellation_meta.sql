-- Cancellation metadata + tutor cancel/update on own published sessions.

ALTER TABLE public.scheduled_sessions
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.scheduled_sessions.cancelled_at IS
  'When the session was cancelled (status = CANCELLED).';
COMMENT ON COLUMN public.scheduled_sessions.cancellation_reason IS
  'Required explanation when cancelling a session.';

-- Tutors may cancel (update) their own published-series sessions.
DROP POLICY IF EXISTS "scheduled_sessions_tutor_update_own" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_tutor_update_own" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.schedule_series ss
      WHERE ss.id = scheduled_sessions.series_id
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
    )
  )
  WITH CHECK (tutor_id = auth.uid());
