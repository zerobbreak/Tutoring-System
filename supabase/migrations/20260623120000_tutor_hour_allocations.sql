-- Tutor hour allocations per module + academic term (Option A: reserved vs worked).

CREATE TABLE IF NOT EXISTS public.tutor_hour_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules (id) ON DELETE CASCADE,
  academic_term_id uuid NOT NULL REFERENCES public.academic_terms (id) ON DELETE CASCADE,
  allocated_hours numeric(8, 2) NOT NULL,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_hour_allocations_hours_positive CHECK (allocated_hours > 0),
  CONSTRAINT tutor_hour_allocations_unique_scope UNIQUE (tutor_id, module_id, academic_term_id)
);

COMMENT ON TABLE public.tutor_hour_allocations IS
  'Maximum teaching hours a tutor may reserve per module and academic term.';

CREATE INDEX IF NOT EXISTS idx_tutor_hour_allocations_tutor
  ON public.tutor_hour_allocations (tutor_id);

CREATE INDEX IF NOT EXISTS idx_tutor_hour_allocations_module_term
  ON public.tutor_hour_allocations (module_id, academic_term_id);

CREATE INDEX IF NOT EXISTS idx_tutor_hour_allocations_institution
  ON public.tutor_hour_allocations (institution_id);

ALTER TABLE public.tutor_hour_allocations ENABLE ROW LEVEL SECURITY;

-- Tutor: read own allocations
DROP POLICY IF EXISTS "tutor_hour_allocations_tutor_select" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_tutor_select" ON public.tutor_hour_allocations
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

-- Lecturer: read/write allocations on own modules
DROP POLICY IF EXISTS "tutor_hour_allocations_lecturer_select" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_lecturer_select" ON public.tutor_hour_allocations
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_module(module_id));

DROP POLICY IF EXISTS "tutor_hour_allocations_lecturer_insert" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_lecturer_insert" ON public.tutor_hour_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
    AND institution_id = public.get_auth_user_institution_id()
    AND EXISTS (
      SELECT 1 FROM public.academic_terms t
      WHERE t.id = academic_term_id
        AND t.institution_id = institution_id
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = tutor_id AND u.role = 'TUTOR'::public.user_role
    )
  );

DROP POLICY IF EXISTS "tutor_hour_allocations_lecturer_update" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_lecturer_update" ON public.tutor_hour_allocations
  FOR UPDATE TO authenticated
  USING (public.is_lecturer_for_module(module_id))
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "tutor_hour_allocations_lecturer_delete" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_lecturer_delete" ON public.tutor_hour_allocations
  FOR DELETE TO authenticated
  USING (public.is_lecturer_for_module(module_id));

-- Admin: full CRUD within institution
DROP POLICY IF EXISTS "tutor_hour_allocations_admin_select" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_admin_select" ON public.tutor_hour_allocations
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "tutor_hour_allocations_admin_insert" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_admin_insert" ON public.tutor_hour_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
    AND institution_id = public.get_auth_user_institution_id()
    AND EXISTS (
      SELECT 1 FROM public.academic_terms t
      WHERE t.id = academic_term_id
        AND t.institution_id = institution_id
    )
  );

DROP POLICY IF EXISTS "tutor_hour_allocations_admin_update" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_admin_update" ON public.tutor_hour_allocations
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "tutor_hour_allocations_admin_delete" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_admin_delete" ON public.tutor_hour_allocations
  FOR DELETE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );
