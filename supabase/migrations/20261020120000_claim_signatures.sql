-- Digital signatures on claims:
-- 1) Each user draws a signature once (user_signatures) and reuses it.
-- 2) Every claim step (submit, reopen, verify/dispute/reject, admin decisions)
--    records an immutable claim_signatures row: a copy of the signature image,
--    who signed in which role, and a SHA-256 hash of the claim's content at
--    signing time so later edits are detectable.

-- ========== user_signatures ==========

CREATE TABLE IF NOT EXISTS public.user_signatures (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  image_data_url text NOT NULL
    CHECK (image_data_url LIKE 'data:image/png;base64,%' AND length(image_data_url) <= 200000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_signatures IS
  'Saved drawn signature (PNG data URL), reused when signing claim steps.';

DROP TRIGGER IF EXISTS trg_user_signatures_updated_at ON public.user_signatures;
CREATE TRIGGER trg_user_signatures_updated_at
  BEFORE UPDATE ON public.user_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_signatures_owner" ON public.user_signatures;
CREATE POLICY "user_signatures_owner" ON public.user_signatures
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_signatures TO authenticated;

-- ========== claim_signatures ==========

CREATE TABLE IF NOT EXISTS public.claim_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.session_claims (id) ON DELETE CASCADE,
  signer_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  signer_role text NOT NULL CHECK (signer_role IN ('TUTOR', 'LECTURER', 'ADMIN')),
  action_type text NOT NULL,
  image_data_url text NOT NULL
    CHECK (image_data_url LIKE 'data:image/png;base64,%' AND length(image_data_url) <= 200000),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.claim_signatures IS
  'Immutable signature record per claim workflow step, with a hash of the claim content at signing time.';

CREATE INDEX IF NOT EXISTS idx_claim_signatures_claim
  ON public.claim_signatures (claim_id, signed_at);

ALTER TABLE public.claim_signatures ENABLE ROW LEVEL SECURITY;

-- Anyone who can see the claim (tutor owner, module lecturer, institution
-- admin, via session_claims RLS) can read its signatures.
DROP POLICY IF EXISTS "claim_signatures_select_visible_claim" ON public.claim_signatures;
CREATE POLICY "claim_signatures_select_visible_claim" ON public.claim_signatures
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_claims c
      WHERE c.id = claim_signatures.claim_id
    )
  );

-- Users sign only as themselves, only on claims they can see.
DROP POLICY IF EXISTS "claim_signatures_insert_self" ON public.claim_signatures;
CREATE POLICY "claim_signatures_insert_self" ON public.claim_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    signer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.session_claims c
      WHERE c.id = claim_signatures.claim_id
    )
  );

-- No UPDATE / DELETE policies: signatures are append-only for app users.
GRANT SELECT, INSERT ON public.claim_signatures TO authenticated;
