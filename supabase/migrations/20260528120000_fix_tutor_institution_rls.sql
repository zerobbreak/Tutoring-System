-- Fix institution matching for tutor assignment and lecturer tutor directory (NULL-safe).

CREATE OR REPLACE FUNCTION public.is_same_institution_as_auth(p_user_id uuid)
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
      AND u.role = 'TUTOR'::public.user_role
      AND u.institution_id IS NOT DISTINCT FROM public.user_institution_id(auth.uid())
  );
$$;

DROP POLICY IF EXISTS "users_select_tutors_same_institution_for_lecturer" ON public.users;
CREATE POLICY "users_select_tutors_same_institution_for_lecturer" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'TUTOR'::public.user_role
    AND public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
  );
