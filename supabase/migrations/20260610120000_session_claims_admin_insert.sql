-- Allow institution admins to create session_claims when publishing schedules
-- (mirrors lecturer bridge insert; admin update/select already exist).

DROP POLICY IF EXISTS "session_claims_admin_insert" ON public.session_claims;
CREATE POLICY "session_claims_admin_insert" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND (
      source_scheduled_session_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.scheduled_sessions s
        WHERE s.id = source_scheduled_session_id
          AND s.module_id = session_claims.module_id
          AND s.tutor_id = session_claims.tutor_id
      )
    )
  );
