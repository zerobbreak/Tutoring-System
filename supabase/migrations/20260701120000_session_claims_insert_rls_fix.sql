-- Fix session_claims INSERT RLS failures when:
-- 1) publish reconciles claims before schedule_series is PUBLISHED (tutor policy);
-- 2) INSERT WITH CHECK subqueries cannot see scheduled_sessions under caller RLS.

-- Tutor: claim a published scheduled occurrence they own.
CREATE OR REPLACE FUNCTION public.auth_tutor_can_insert_claim_for_scheduled_session(
  p_source_scheduled_session_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.scheduled_sessions s
    INNER JOIN public.schedule_series ss ON ss.id = s.series_id
    WHERE s.id = p_source_scheduled_session_id
      AND s.tutor_id = auth.uid()
      AND s.deleted_at IS NULL
      AND ss.status = 'PUBLISHED'::public.schedule_series_status
      AND ss.deleted_at IS NULL
  );
$$;

-- Lecturer/admin: bridge claim row matches an existing scheduled occurrence.
CREATE OR REPLACE FUNCTION public.auth_can_insert_claim_for_scheduled_session(
  p_source_scheduled_session_id uuid,
  p_module_id uuid,
  p_tutor_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.scheduled_sessions s
    WHERE s.id = p_source_scheduled_session_id
      AND s.module_id = p_module_id
      AND s.tutor_id = p_tutor_id
      AND s.deleted_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_tutor_can_insert_claim_for_scheduled_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_can_insert_claim_for_scheduled_session(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "session_claims_tutor_insert_own" ON public.session_claims;
CREATE POLICY "session_claims_tutor_insert_own" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND source_scheduled_session_id IS NULL
    AND (
      source_schedule_import_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.tutor_schedule_imports i
        WHERE i.id = source_schedule_import_id
          AND i.tutor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "session_claims_tutor_insert_scheduled_session" ON public.session_claims;
CREATE POLICY "session_claims_tutor_insert_scheduled_session" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND source_scheduled_session_id IS NOT NULL
    AND public.auth_tutor_can_insert_claim_for_scheduled_session(source_scheduled_session_id)
  );

DROP POLICY IF EXISTS "session_claims_lecturer_insert_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_insert_own_modules" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND (
      source_scheduled_session_id IS NULL
      OR public.auth_can_insert_claim_for_scheduled_session(
        source_scheduled_session_id,
        module_id,
        tutor_id
      )
    )
  );

DROP POLICY IF EXISTS "session_claims_admin_insert" ON public.session_claims;
CREATE POLICY "session_claims_admin_insert" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND (
      source_scheduled_session_id IS NULL
      OR public.auth_can_insert_claim_for_scheduled_session(
        source_scheduled_session_id,
        module_id,
        tutor_id
      )
    )
  );
