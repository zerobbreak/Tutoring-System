-- Fix infinite recursion in users_update_self (subqueries on users re-entered RLS).

CREATE OR REPLACE FUNCTION public.get_auth_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_active FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_approval_status()
RETURNS public.user_approval_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT approval_status FROM public.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_user_is_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_approval_status() TO authenticated;

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
  );

-- Storage admin policy: avoid bare users subquery under RLS
CREATE OR REPLACE FUNCTION public.user_belongs_to_auth_institution(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_belongs_to_auth_institution(uuid) TO authenticated;

DROP POLICY IF EXISTS "onboarding_docs_select_admin" ON storage.objects;
CREATE POLICY "onboarding_docs_select_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'onboarding-documents'
    AND public.auth_user_is_admin()
    AND public.user_belongs_to_auth_institution(
      ((storage.foldername(name))[1])::uuid
    )
  );
