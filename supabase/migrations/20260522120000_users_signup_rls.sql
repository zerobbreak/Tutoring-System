-- Allow self-registration: nullable institution (linked later in settings) + insert RLS + auth trigger

ALTER TABLE public.users
  ALTER COLUMN institution_id DROP NOT NULL;

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Create public.users row when auth.users is created (works before email confirm / session)
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

  INSERT INTO public.users (id, email, full_name, role, institution_id)
  VALUES (NEW.id, NEW.email, name_val, role_val, NULL)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
