-- tutor_id must match auth.uid(); public.users rows are not guaranteed at signup.
ALTER TABLE public.tutor_schedule_imports
  DROP CONSTRAINT IF EXISTS tutor_schedule_imports_tutor_id_fkey;

ALTER TABLE public.tutor_schedule_imports
  ADD CONSTRAINT tutor_schedule_imports_tutor_id_fkey
  FOREIGN KEY (tutor_id) REFERENCES auth.users (id) ON DELETE CASCADE;
