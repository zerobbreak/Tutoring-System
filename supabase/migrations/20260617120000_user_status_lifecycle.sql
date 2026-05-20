-- Enterprise user lifecycle: user_status + onboarding_step, RLS platform access.

-- ---------------------------------------------------------------------------
-- user_status enum + columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_status AS ENUM (
      'PENDING_APPROVAL',
      'ACTIVE',
      'SUSPENDED',
      'REJECTED'
    );
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_status public.user_status;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_step text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_onboarding_step_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_onboarding_step_check CHECK (
    onboarding_step IS NULL
    OR onboarding_step IN ('documents', 'ready_for_review')
  );

COMMENT ON COLUMN public.users.user_status IS
  'Account lifecycle: PENDING_APPROVAL → ACTIVE; admin may SUSPEND or REJECT.';
COMMENT ON COLUMN public.users.onboarding_step IS
  'When PENDING_APPROVAL: documents (upload KYC) or ready_for_review (awaiting admin).';

-- Backfill from legacy approval_status + is_active
UPDATE public.users
SET
  user_status = CASE
    WHEN approval_status = 'rejected'::public.user_approval_status THEN
      'REJECTED'::public.user_status
    WHEN approval_status = 'approved'::public.user_approval_status
      AND COALESCE(is_active, true) = false THEN
      'SUSPENDED'::public.user_status
    WHEN approval_status = 'approved'::public.user_approval_status THEN
      'ACTIVE'::public.user_status
    ELSE
      'PENDING_APPROVAL'::public.user_status
  END,
  onboarding_step = CASE
    WHEN approval_status = 'pending_review'::public.user_approval_status THEN
      'ready_for_review'
    WHEN approval_status = 'pending_documents'::public.user_approval_status THEN
      'documents'
    ELSE
      NULL
  END
WHERE user_status IS NULL;

ALTER TABLE public.users
  ALTER COLUMN user_status SET DEFAULT 'PENDING_APPROVAL'::public.user_status;

ALTER TABLE public.users
  ALTER COLUMN user_status SET NOT NULL;

-- Keep legacy columns aligned on lifecycle changes
CREATE OR REPLACE FUNCTION public.sync_user_lifecycle_legacy_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_status IS NULL THEN
    RETURN NEW;
  END IF;

  CASE NEW.user_status
    WHEN 'ACTIVE' THEN
      NEW.approval_status := 'approved'::public.user_approval_status;
      NEW.is_active := true;
      NEW.onboarding_step := NULL;
    WHEN 'PENDING_APPROVAL' THEN
      NEW.is_active := true;
      IF NEW.onboarding_step = 'ready_for_review' THEN
        NEW.approval_status := 'pending_review'::public.user_approval_status;
      ELSE
        IF NEW.onboarding_step IS NULL THEN
          NEW.onboarding_step := 'documents';
        END IF;
        NEW.approval_status := 'pending_documents'::public.user_approval_status;
      END IF;
    WHEN 'SUSPENDED' THEN
      NEW.approval_status := 'approved'::public.user_approval_status;
      NEW.is_active := false;
      NEW.onboarding_step := NULL;
    WHEN 'REJECTED' THEN
      NEW.approval_status := 'rejected'::public.user_approval_status;
      NEW.is_active := false;
      NEW.onboarding_step := NULL;
    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_sync_lifecycle ON public.users;
CREATE TRIGGER trg_users_sync_lifecycle
  BEFORE INSERT OR UPDATE OF user_status, onboarding_step
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_lifecycle_legacy_columns();

-- Auth signup trigger: default lifecycle for new profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
  role_val public.user_role;
  name_val text;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  name_val := COALESCE(meta->>'full_name', split_part(NEW.email, '@', 1));

  BEGIN
    role_val := (meta->>'role')::public.user_role;
  EXCEPTION
    WHEN others THEN
      role_val := 'TUTOR'::public.user_role;
  END;

  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    institution_id,
    user_status,
    onboarding_step
  )
  VALUES (
    NEW.id,
    NEW.email,
    name_val,
    role_val,
    NULL,
    'PENDING_APPROVAL'::public.user_status,
    'documents'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_user_status()
RETURNS public.user_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_status FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_onboarding_step()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT onboarding_step FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_has_platform_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_auth_user_status() = 'ACTIVE'::public.user_status;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_user_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_onboarding_step() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_has_platform_access() TO authenticated;

-- Self-update: users cannot change lifecycle fields
DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.get_auth_user_role()
    AND institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
    AND is_active = public.get_auth_user_is_active()
    AND approval_status = public.get_auth_user_approval_status()
    AND user_status = public.get_auth_user_status()
    AND onboarding_step IS NOT DISTINCT FROM public.get_auth_user_onboarding_step()
  );

-- ---------------------------------------------------------------------------
-- Platform access on sensitive tutor write paths
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_claims_tutor_select" ON public.session_claims;
CREATE POLICY "session_claims_tutor_select" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  );

DROP POLICY IF EXISTS "session_claims_tutor_update" ON public.session_claims;
CREATE POLICY "session_claims_tutor_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  )
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  );

DROP POLICY IF EXISTS "session_claims_tutor_insert_own" ON public.session_claims;
CREATE POLICY "session_claims_tutor_insert_own" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
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
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      INNER JOIN public.schedule_series ss ON ss.id = s.series_id
      WHERE s.id = source_scheduled_session_id
        AND s.tutor_id = auth.uid()
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
    )
  );

DROP POLICY IF EXISTS "session_claims_lecturer_update_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_update_own_modules" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND public.auth_user_has_platform_access()
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND public.auth_user_has_platform_access()
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  );
