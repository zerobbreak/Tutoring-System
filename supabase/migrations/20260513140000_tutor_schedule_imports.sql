-- Persisted tutor timetable imports (UI: /tutor/schedules)
CREATE TABLE IF NOT EXISTS public.tutor_schedule_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  file_name text NOT NULL,
  parse_result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_schedule_imports IS 'Each row is one uploaded spreadsheet parse; the UI merges multiple rows per tutor into one calendar.';

CREATE INDEX IF NOT EXISTS idx_tutor_schedule_imports_tutor_created
  ON public.tutor_schedule_imports (tutor_id, created_at);

DROP TRIGGER IF EXISTS trg_tutor_schedule_imports_updated_at ON public.tutor_schedule_imports;
CREATE TRIGGER trg_tutor_schedule_imports_updated_at
  BEFORE UPDATE ON public.tutor_schedule_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tutor_schedule_imports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON TABLE public.tutor_schedule_imports TO authenticated;

DROP POLICY IF EXISTS "tutor_schedule_imports_select_own" ON public.tutor_schedule_imports;
CREATE POLICY "tutor_schedule_imports_select_own" ON public.tutor_schedule_imports
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "tutor_schedule_imports_insert_own" ON public.tutor_schedule_imports;
CREATE POLICY "tutor_schedule_imports_insert_own" ON public.tutor_schedule_imports
  FOR INSERT TO authenticated
  WITH CHECK (tutor_id = auth.uid());

DROP POLICY IF EXISTS "tutor_schedule_imports_delete_own" ON public.tutor_schedule_imports;
CREATE POLICY "tutor_schedule_imports_delete_own" ON public.tutor_schedule_imports
  FOR DELETE TO authenticated
  USING (tutor_id = auth.uid());
