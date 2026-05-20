-- Tutor "Create session" requires admin approval; schedule/import-linked claims auto-approve.

ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS admin_creation_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_creation_approved_by uuid REFERENCES public.users (id);

COMMENT ON COLUMN public.session_claims.admin_creation_approved_at IS
  'When set, a tutor-created (manual) session is visible on tutor dashboards.';
COMMENT ON COLUMN public.session_claims.admin_creation_approved_by IS
  'Admin who approved a tutor-created session.';

-- Existing schedule/import claims do not need manual approval.
UPDATE public.session_claims
SET admin_creation_approved_at = COALESCE(updated_at, now())
WHERE admin_creation_approved_at IS NULL
  AND (
    source_scheduled_session_id IS NOT NULL
    OR source_schedule_import_id IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.session_claims_auto_approve_linked_creation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source_scheduled_session_id IS NOT NULL
     OR NEW.source_schedule_import_id IS NOT NULL THEN
    NEW.admin_creation_approved_at := COALESCE(NEW.admin_creation_approved_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_claims_auto_approve_linked ON public.session_claims;
CREATE TRIGGER trg_session_claims_auto_approve_linked
  BEFORE INSERT ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.session_claims_auto_approve_linked_creation();
