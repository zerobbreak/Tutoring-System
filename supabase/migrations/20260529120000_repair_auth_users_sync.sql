-- Repair public.users sync from auth.users (backfill + hardened trigger).

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
  name_val := COALESCE(NULLIF(trim(meta->>'full_name'), ''), split_part(NEW.email, '@', 1));

  BEGIN
    role_val := (meta->>'role')::public.user_role;
  EXCEPTION
    WHEN others THEN
      role_val := 'TUTOR'::public.user_role;
  END;

  INSERT INTO public.users (id, email, full_name, role, institution_id, is_active)
  VALUES (NEW.id, NEW.email, name_val, role_val, NULL, true)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(trim(EXCLUDED.full_name), ''), public.users.full_name),
    role = EXCLUDED.role,
    is_active = true;

  RETURN NEW;
END;
$$;

-- Backfill any auth users missing from public.users
INSERT INTO public.users (id, email, full_name, role, institution_id, is_active)
SELECT
  au.id,
  au.email,
  COALESCE(
    NULLIF(trim(au.raw_user_meta_data->>'full_name'), ''),
    split_part(au.email, '@', 1)
  ),
  COALESCE(
    (au.raw_user_meta_data->>'role')::public.user_role,
    'TUTOR'::public.user_role
  ),
  NULL,
  true
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;
