-- Admin approvals: freeze flag, write RLS, payroll export access.

ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

COMMENT ON COLUMN public.session_claims.frozen_at IS
  'When set, claim status changes are blocked until cleared by an admin.';

-- session_claims: admin update (frozen claims blocked in server actions)
DROP POLICY IF EXISTS "session_claims_admin_update" ON public.session_claims;
CREATE POLICY "session_claims_admin_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- verification_actions: admin insert audit trail
DROP POLICY IF EXISTS "verification_actions_admin_insert" ON public.verification_actions;
CREATE POLICY "verification_actions_admin_insert" ON public.verification_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()::uuid
    AND public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

-- disputes: admin update (escalate, resolve)
DROP POLICY IF EXISTS "disputes_admin_update" ON public.disputes;
CREATE POLICY "disputes_admin_update" ON public.disputes
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

-- payroll_exports
DROP POLICY IF EXISTS "payroll_exports_admin_select" ON public.payroll_exports;
CREATE POLICY "payroll_exports_admin_select" ON public.payroll_exports
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "payroll_exports_admin_insert" ON public.payroll_exports;
CREATE POLICY "payroll_exports_admin_insert" ON public.payroll_exports
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
    AND generated_by_id = auth.uid()
  );

-- payroll_export_claims
DROP POLICY IF EXISTS "payroll_export_claims_admin_select" ON public.payroll_export_claims;
CREATE POLICY "payroll_export_claims_admin_select" ON public.payroll_export_claims
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.payroll_exports pe
      WHERE pe.id = payroll_export_claims.export_id
        AND pe.institution_id = public.get_auth_user_institution_id()
    )
  );

DROP POLICY IF EXISTS "payroll_export_claims_admin_insert" ON public.payroll_export_claims;
CREATE POLICY "payroll_export_claims_admin_insert" ON public.payroll_export_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.payroll_exports pe
      WHERE pe.id = payroll_export_claims.export_id
        AND pe.institution_id = public.get_auth_user_institution_id()
    )
  );

-- Storage: admin read attendance registers for institution claims
DROP POLICY IF EXISTS "attendance_registers_select_admin" ON storage.objects;
CREATE POLICY "attendance_registers_select_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance_registers'
    AND public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      INNER JOIN public.modules m ON m.id = sc.module_id
      WHERE m.institution_id = public.get_auth_user_institution_id()
        AND sc.tutor_id::text = (storage.foldername(name))[1]
        AND sc.id::text = (storage.foldername(name))[2]
    )
  );
