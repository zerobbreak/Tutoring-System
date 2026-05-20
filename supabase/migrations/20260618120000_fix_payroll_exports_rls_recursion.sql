-- Break payroll_exports <-> payroll_export_claims RLS recursion by using
-- SECURITY DEFINER helpers (same pattern as get_auth_user_institution_id).

CREATE OR REPLACE FUNCTION public.is_payroll_export_in_auth_institution(p_export_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payroll_exports pe
    WHERE pe.id = p_export_id
      AND pe.institution_id = public.get_auth_user_institution_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.tutor_owns_claim_in_payroll_export(p_export_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payroll_export_claims pec
    INNER JOIN public.session_claims sc ON sc.id = pec.claim_id
    WHERE pec.export_id = p_export_id
      AND sc.tutor_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_payroll_export_in_auth_institution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_owns_claim_in_payroll_export(uuid) TO authenticated;

-- payroll_export_claims: stop selecting payroll_exports inside policy
DROP POLICY IF EXISTS "payroll_export_claims_admin_select" ON public.payroll_export_claims;
CREATE POLICY "payroll_export_claims_admin_select" ON public.payroll_export_claims
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_payroll_export_in_auth_institution(export_id)
  );

DROP POLICY IF EXISTS "payroll_export_claims_admin_insert" ON public.payroll_export_claims;
CREATE POLICY "payroll_export_claims_admin_insert" ON public.payroll_export_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_payroll_export_in_auth_institution(export_id)
  );

-- payroll_exports: stop selecting payroll_export_claims inside policy
DROP POLICY IF EXISTS "payroll_exports_tutor_select" ON public.payroll_exports;
CREATE POLICY "payroll_exports_tutor_select" ON public.payroll_exports
  FOR SELECT TO authenticated
  USING (public.tutor_owns_claim_in_payroll_export(id));
