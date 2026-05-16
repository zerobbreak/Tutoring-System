-- Admin: create modules in institution; unique code per institution.

CREATE UNIQUE INDEX IF NOT EXISTS idx_modules_institution_code_unique
  ON public.modules (institution_id, lower(code::text));

DROP POLICY IF EXISTS "modules_admin_insert_institution" ON public.modules;
CREATE POLICY "modules_admin_insert_institution" ON public.modules
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );
