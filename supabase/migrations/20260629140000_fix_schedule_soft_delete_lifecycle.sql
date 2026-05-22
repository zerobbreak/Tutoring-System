-- Keep the schedule lifecycle consistent with soft deletes:
-- - Deleted claims should not block a replacement claim for the same schedule occurrence.
-- - Lecturers must be able to soft-delete draft scheduled sessions/series they own.

DROP INDEX IF EXISTS public.idx_session_claims_scheduled_session_unique;
CREATE UNIQUE INDEX idx_session_claims_scheduled_session_unique
  ON public.session_claims (tutor_id, source_scheduled_session_id)
  WHERE source_scheduled_session_id IS NOT NULL
    AND deleted_at IS NULL;

DROP POLICY IF EXISTS "scheduled_sessions_lecturer_all" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_lecturer_all" ON public.scheduled_sessions
  FOR ALL TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_lecturer_for_module(module_id)
  )
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
  );

DROP POLICY IF EXISTS "schedule_series_lecturer_all" ON public.schedule_series;
CREATE POLICY "schedule_series_lecturer_all" ON public.schedule_series
  FOR ALL TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_lecturer_for_module(module_id)
  )
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND created_by = auth.uid()::uuid
  );
