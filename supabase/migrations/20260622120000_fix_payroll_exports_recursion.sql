-- Fix RLS recursion on public.payroll_exports and public.payroll_export_claims.
-- This occurs because:
--   1. payroll_exports RLS selects from payroll_export_claims.
--   2. payroll_export_claims RLS selects from payroll_exports.
-- Using SECURITY DEFINER functions bypasses RLS evaluation during the internal queries, breaking the circular dependency.

-- 1. Function to check if a user can select a payroll export
CREATE OR REPLACE FUNCTION public.can_user_select_payroll_export(p_export_id uuid, p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is admin/super_admin and the export is in their institution
  SELECT (
    public.auth_user_is_admin()
    AND p_institution_id = public.get_auth_user_institution_id()
  ) OR (
    -- Check if user is a tutor and has a claim included in this export
    EXISTS (
      SELECT 1
      FROM public.payroll_export_claims pec
      JOIN public.session_claims sc ON sc.id = pec.claim_id
      WHERE pec.export_id = p_export_id
        AND sc.tutor_id = auth.uid()
    )
  );
$$;

-- 2. Function to check if a user can select a payroll export claim record
CREATE OR REPLACE FUNCTION public.can_user_select_payroll_export_claim(p_claim_id uuid, p_export_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is a tutor and owns the underlying session claim
  SELECT (
    EXISTS (
      SELECT 1 FROM public.session_claims sc
      WHERE sc.id = p_claim_id
        AND sc.tutor_id = auth.uid()
    )
  ) OR (
    -- Check if user is admin/super_admin and the associated export is in their institution
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1 FROM public.payroll_exports pe
      WHERE pe.id = p_export_id
        AND pe.institution_id = public.get_auth_user_institution_id()
    )
  );
$$;

-- 3. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.can_user_select_payroll_export(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_select_payroll_export_claim(uuid, uuid) TO authenticated;

-- 4. Recreate select policies for public.payroll_exports using the security definer function
DROP POLICY IF EXISTS "payroll_exports_admin_select" ON public.payroll_exports;
DROP POLICY IF EXISTS "payroll_exports_tutor_select" ON public.payroll_exports;
DROP POLICY IF EXISTS "payroll_exports_select" ON public.payroll_exports;

CREATE POLICY "payroll_exports_select" ON public.payroll_exports
  FOR SELECT TO authenticated
  USING (
    public.can_user_select_payroll_export(id, institution_id)
  );

-- 5. Recreate select policies for public.payroll_export_claims using the security definer function
DROP POLICY IF EXISTS "payroll_export_claims_admin_select" ON public.payroll_export_claims;
DROP POLICY IF EXISTS "payroll_export_claims_tutor_select" ON public.payroll_export_claims;
DROP POLICY IF EXISTS "payroll_export_claims_select" ON public.payroll_export_claims;

CREATE POLICY "payroll_export_claims_select" ON public.payroll_export_claims
  FOR SELECT TO authenticated
  USING (
    public.can_user_select_payroll_export_claim(claim_id, export_id)
  );
