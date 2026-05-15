-- Fix RLS recursion by using security definer functions to look up user metadata.
-- This prevents policies on 'users' from querying 'users' recursively.

-- 1. Helper function to get current user's institution_id
CREATE OR REPLACE FUNCTION public.get_auth_user_institution_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM public.users WHERE id = auth.uid();
$$;

-- 2. Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- 3. Helper function to check if user has a specific role (or list of roles)
CREATE OR REPLACE FUNCTION public.auth_user_has_role(target_role public.user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = target_role FROM public.users WHERE id = auth.uid();
$$;

-- 4. Update the recursive policy on public.users
DROP POLICY IF EXISTS "users_select_lecturers_same_institution" ON public.users;
CREATE POLICY "users_select_lecturers_same_institution" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'LECTURER'::public.user_role
    AND institution_id = public.get_auth_user_institution_id()
  );

-- 5. Update other policies that query users to use the new helper functions (Optimization & Prevention)
DROP POLICY IF EXISTS "students_select_same_institution" ON public.students;
CREATE POLICY "students_select_same_institution" ON public.students
  FOR SELECT TO authenticated
  USING (institution_id = public.get_auth_user_institution_id());

DROP POLICY IF EXISTS "students_insert_same_institution" ON public.students;
CREATE POLICY "students_insert_same_institution" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (institution_id = public.get_auth_user_institution_id());

DROP POLICY IF EXISTS "students_update_same_institution" ON public.students;
CREATE POLICY "students_update_same_institution" ON public.students
  FOR UPDATE TO authenticated
  USING (institution_id = public.get_auth_user_institution_id())
  WITH CHECK (institution_id = public.get_auth_user_institution_id());

-- Update tutor_student_assignments policies
DROP POLICY IF EXISTS "tutor_student_assignments_insert_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_insert_own" ON public.tutor_student_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_id
        AND s.institution_id = public.get_auth_user_institution_id()
    )
  );

DROP POLICY IF EXISTS "tutor_student_assignments_update_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_update_own" ON public.tutor_student_assignments
  FOR UPDATE TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_id
        AND s.institution_id = public.get_auth_user_institution_id()
    )
  );

-- Update modules policy
DROP POLICY IF EXISTS "modules_select_same_institution" ON public.modules;
CREATE POLICY "modules_select_same_institution" ON public.modules
  FOR SELECT TO authenticated
  USING (institution_id = public.get_auth_user_institution_id());
