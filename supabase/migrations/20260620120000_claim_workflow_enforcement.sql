-- Claim workflow enforcement (keep transition matrix in sync with src/lib/claim-workflow/transitions.ts)

ALTER TABLE public.verification_actions
  ADD COLUMN IF NOT EXISTS attestation_method text NOT NULL DEFAULT 'NONE';

COMMENT ON COLUMN public.verification_actions.attestation_method IS
  'How the actor attested: NONE, TOTP_STEP_UP, or legacy values in mfa_method.';

-- ---------------------------------------------------------------------------
-- Status transition guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_allowed_claim_status_transition(
  p_from public.claim_status,
  p_to public.claim_status,
  p_role public.user_role
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_from IS NOT DISTINCT FROM p_to THEN
    RETURN true;
  END IF;

  -- Tutor
  IF p_role = 'TUTOR'::public.user_role THEN
    RETURN (p_from = 'DRAFT' AND p_to = 'PENDING_VERIFICATION')
      OR (p_from = 'REJECTED' AND p_to = 'DRAFT')
      OR (p_from = 'DISPUTED' AND p_to = 'DRAFT');
  END IF;

  -- Lecturer
  IF p_role = 'LECTURER'::public.user_role THEN
    RETURN (p_from = 'PENDING_VERIFICATION' AND p_to IN ('VERIFIED', 'REJECTED', 'DISPUTED'))
      OR (p_from = 'DISPUTED' AND p_to IN ('VERIFIED', 'REJECTED'));
  END IF;

  -- Admin / super admin
  IF p_role IN ('ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role) THEN
    RETURN (p_from = 'VERIFIED' AND p_to IN ('APPROVED', 'REJECTED', 'PENDING_VERIFICATION'))
      OR (p_from = 'DISPUTED' AND p_to = 'REJECTED');
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_session_claim_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Service role / migrations (no end-user JWT)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'APPROVED'::public.claim_status THEN
    RAISE EXCEPTION 'Approved session claims cannot be modified.';
  END IF;

  v_role := public.get_auth_user_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Cannot change claim status without an authenticated role.';
  END IF;

  IF NOT public.is_allowed_claim_status_transition(OLD.status, NEW.status, v_role) THEN
    RAISE EXCEPTION 'Disallowed claim status transition from % to % for role %',
      OLD.status, NEW.status, v_role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_session_claim_status ON public.session_claims;
CREATE TRIGGER trg_enforce_session_claim_status
  BEFORE UPDATE ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_claim_status_transition();

-- ---------------------------------------------------------------------------
-- Approved-row immutability (any column change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_session_claim_approved_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'APPROVED'::public.claim_status AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Approved session claims are immutable.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_claim_approved_immutable ON public.session_claims;
CREATE TRIGGER trg_session_claim_approved_immutable
  BEFORE UPDATE ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_claim_approved_immutable();

-- ---------------------------------------------------------------------------
-- Tutor update: editable statuses only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_claims_tutor_update" ON public.session_claims;
CREATE POLICY "session_claims_tutor_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND status IN (
      'DRAFT'::public.claim_status,
      'REJECTED'::public.claim_status,
      'DISPUTED'::public.claim_status
    )
    AND frozen_at IS NULL
  )
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND frozen_at IS NULL
    AND status IN (
      'DRAFT'::public.claim_status,
      'REJECTED'::public.claim_status,
      'DISPUTED'::public.claim_status,
      'PENDING_VERIFICATION'::public.claim_status
    )
  );

-- ---------------------------------------------------------------------------
-- Append-only audit tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "verification_actions_no_update" ON public.verification_actions;
CREATE POLICY "verification_actions_no_update" ON public.verification_actions
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "verification_actions_no_delete" ON public.verification_actions;
CREATE POLICY "verification_actions_no_delete" ON public.verification_actions
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "audit_logs_no_update" ON public.audit_logs;
CREATE POLICY "audit_logs_no_update" ON public.audit_logs
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "audit_logs_no_delete" ON public.audit_logs;
CREATE POLICY "audit_logs_no_delete" ON public.audit_logs
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (false);
