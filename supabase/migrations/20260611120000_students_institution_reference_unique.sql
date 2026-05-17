-- One student number per institution; supports roster + QR check-in upsert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_institution_reference_unique
  ON public.students (institution_id, student_reference)
  WHERE student_reference IS NOT NULL AND btrim(student_reference) <> '';
