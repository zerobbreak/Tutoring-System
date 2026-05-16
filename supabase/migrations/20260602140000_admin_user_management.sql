-- Admin user management: onboarding approval, documents, admin write RLS.

-- ---------------------------------------------------------------------------
-- user_approval_status enum + users columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_approval_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_approval_status AS ENUM (
      'pending_documents',
      'pending_review',
      'approved',
      'rejected'
    );
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_status public.user_approval_status
    DEFAULT 'pending_documents'::public.user_approval_status;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_reviewed_at timestamptz;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_reviewed_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_note text;

-- Existing users keep full access
UPDATE public.users
SET approval_status = 'approved'::public.user_approval_status
WHERE approval_status IS NULL
   OR approval_status = 'pending_documents'::public.user_approval_status;

ALTER TABLE public.users
  ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE public.users
  ALTER COLUMN approval_status SET DEFAULT 'pending_documents'::public.user_approval_status;

COMMENT ON COLUMN public.users.approval_status IS
  'Institutional onboarding: documents → admin review → approved.';

-- ---------------------------------------------------------------------------
-- user_onboarding_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  document_kind character varying(50) NOT NULL,
  storage_path text NOT NULL,
  file_name character varying(255) NOT NULL,
  mime_type character varying(100) NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  CONSTRAINT user_onboarding_documents_kind_check CHECK (
    document_kind IN ('government_id', 'employment_confirmation')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_onboarding_documents_user_kind
  ON public.user_onboarding_documents (user_id, document_kind);

ALTER TABLE public.user_onboarding_documents
  DROP CONSTRAINT IF EXISTS user_onboarding_documents_user_kind_key;

ALTER TABLE public.user_onboarding_documents
  ADD CONSTRAINT user_onboarding_documents_user_kind_key
  UNIQUE (user_id, document_kind);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_documents_institution
  ON public.user_onboarding_documents (institution_id);

COMMENT ON TABLE public.user_onboarding_documents IS
  'Required documents submitted during institutional onboarding.';

-- ---------------------------------------------------------------------------
-- Storage: onboarding-documents (private)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('onboarding-documents', 'onboarding-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "onboarding_docs_insert_own" ON storage.objects;
CREATE POLICY "onboarding_docs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'onboarding-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "onboarding_docs_select_own" ON storage.objects;
CREATE POLICY "onboarding_docs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'onboarding-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "onboarding_docs_select_admin" ON storage.objects;
CREATE POLICY "onboarding_docs_select_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'onboarding-documents'
    AND public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = ((storage.foldername(name))[1])::uuid
        AND u.institution_id = public.get_auth_user_institution_id()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: user_onboarding_documents
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_onboarding_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.user_onboarding_documents TO authenticated;

DROP POLICY IF EXISTS "user_onboarding_documents_select_self" ON public.user_onboarding_documents;
CREATE POLICY "user_onboarding_documents_select_self" ON public.user_onboarding_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_onboarding_documents_insert_self" ON public.user_onboarding_documents;
CREATE POLICY "user_onboarding_documents_insert_self" ON public.user_onboarding_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "user_onboarding_documents_admin_select" ON public.user_onboarding_documents;
CREATE POLICY "user_onboarding_documents_admin_select" ON public.user_onboarding_documents
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- RLS: users admin update + harden self-update
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_admin_update_institution" ON public.users;
CREATE POLICY "users_admin_update_institution" ON public.users
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid())
    AND institution_id IS NOT DISTINCT FROM (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
    AND is_active = (SELECT u.is_active FROM public.users u WHERE u.id = auth.uid())
    AND approval_status = (
      SELECT u.approval_status FROM public.users u WHERE u.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: modules admin update (lecturer assignment)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "modules_admin_update_institution" ON public.modules;
CREATE POLICY "modules_admin_update_institution" ON public.modules
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );
