-- Tutor draft discard: soft-delete UPDATE was failing when attendance/claim
-- subqueries in RLS could not see the parent claim under caller SELECT policies.

CREATE OR REPLACE FUNCTION public.auth_tutor_can_soft_delete_claim(p_claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_claims sc
    WHERE sc.id = p_claim_id
      AND sc.tutor_id = auth.uid()
      AND sc.deleted_at IS NULL
      AND sc.status = 'DRAFT'::public.claim_status
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_tutor_can_soft_delete_attendance_for_claim(
  p_claim_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_tutor_can_soft_delete_claim(p_claim_id);
$$;

GRANT EXECUTE ON FUNCTION public.auth_tutor_can_soft_delete_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_tutor_can_soft_delete_attendance_for_claim(uuid) TO authenticated;

DROP POLICY IF EXISTS "session_claims_tutor_soft_delete" ON public.session_claims;
CREATE POLICY "session_claims_tutor_soft_delete" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_has_platform_access()
    AND public.auth_tutor_can_soft_delete_claim(id)
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND status = 'DRAFT'::public.claim_status
  );

DROP POLICY IF EXISTS "session_attendance_tutor_soft_delete" ON public.session_attendance;
CREATE POLICY "session_attendance_tutor_soft_delete" ON public.session_attendance
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_has_platform_access()
    AND public.auth_tutor_can_soft_delete_attendance_for_claim(session_id)
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND public.auth_user_has_platform_access()
    AND public.auth_tutor_can_soft_delete_attendance_for_claim(session_id)
  );
