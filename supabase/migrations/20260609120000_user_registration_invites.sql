-- Per-email registration invites (admin-issued; validated at signup via service role).

CREATE TABLE IF NOT EXISTS public.user_registration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  email character varying(255) NOT NULL,
  full_name character varying(255),
  role public.user_role NOT NULL,
  code_hash text NOT NULL,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_registration_invites_role_check CHECK (
    role IN ('TUTOR', 'LECTURER', 'ADMIN')
  )
);

CREATE INDEX IF NOT EXISTS idx_user_registration_invites_institution
  ON public.user_registration_invites (institution_id);

CREATE INDEX IF NOT EXISTS idx_user_registration_invites_email_active
  ON public.user_registration_invites (lower(email))
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_registration_invites_institution_email_active
  ON public.user_registration_invites (institution_id, lower(email))
  WHERE used_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE public.user_registration_invites IS
  'One-time invite codes for institution staff registration. Managed via server actions only.';

ALTER TABLE public.user_registration_invites ENABLE ROW LEVEL SECURITY;

-- No client policies: all access via service role in server functions.
