-- Institution management: campuses, academic terms, admin RLS.
-- modules.semester / modules.academic_year remain for lecturer workflows;
-- academic_terms is institution master data configured by admins.

-- ---------------------------------------------------------------------------
-- campuses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  name character varying(255) NOT NULL,
  code character varying(50),
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campuses_institution_id ON public.campuses (institution_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campuses_institution_code_unique
  ON public.campuses (institution_id, code)
  WHERE code IS NOT NULL;

COMMENT ON TABLE public.campuses IS 'Physical campuses or sites within an institution.';

-- ---------------------------------------------------------------------------
-- academic_terms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  label character varying(100) NOT NULL,
  academic_year character varying(20) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_terms_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_academic_terms_institution_id
  ON public.academic_terms (institution_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_terms_one_current_per_institution
  ON public.academic_terms (institution_id)
  WHERE is_current = true;

COMMENT ON TABLE public.academic_terms IS 'Institution-configured semesters and academic years.';

-- ---------------------------------------------------------------------------
-- venues.campus_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS campus_id uuid REFERENCES public.campuses (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_venues_campus_id ON public.venues (campus_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_campuses_updated_at ON public.campuses;
CREATE TRIGGER trg_campuses_updated_at
  BEFORE UPDATE ON public.campuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS: campuses
-- ---------------------------------------------------------------------------
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.campuses TO authenticated;

DROP POLICY IF EXISTS "campuses_admin_select" ON public.campuses;
CREATE POLICY "campuses_admin_select" ON public.campuses
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "campuses_admin_insert" ON public.campuses;
CREATE POLICY "campuses_admin_insert" ON public.campuses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "campuses_admin_update" ON public.campuses;
CREATE POLICY "campuses_admin_update" ON public.campuses
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- RLS: academic_terms
-- ---------------------------------------------------------------------------
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.academic_terms TO authenticated;

DROP POLICY IF EXISTS "academic_terms_admin_select" ON public.academic_terms;
CREATE POLICY "academic_terms_admin_select" ON public.academic_terms
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "academic_terms_admin_insert" ON public.academic_terms;
CREATE POLICY "academic_terms_admin_insert" ON public.academic_terms
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "academic_terms_admin_update" ON public.academic_terms;
CREATE POLICY "academic_terms_admin_update" ON public.academic_terms
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "academic_terms_admin_delete" ON public.academic_terms;
CREATE POLICY "academic_terms_admin_delete" ON public.academic_terms
  FOR DELETE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- RLS: institutions (admin own row)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "institutions_admin_select_own" ON public.institutions;
CREATE POLICY "institutions_admin_select_own" ON public.institutions
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "institutions_admin_update_own" ON public.institutions;
CREATE POLICY "institutions_admin_update_own" ON public.institutions
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- RLS: venues (admin manage institution venues)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "venues_admin_insert" ON public.venues;
CREATE POLICY "venues_admin_insert" ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "venues_admin_update" ON public.venues;
CREATE POLICY "venues_admin_update" ON public.venues
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );
