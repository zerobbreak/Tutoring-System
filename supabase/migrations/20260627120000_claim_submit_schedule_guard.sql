-- Block submitting a claim when the linked official session is cancelled or removed.

CREATE OR REPLACE FUNCTION public.enforce_claim_submit_linked_session()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id uuid;
  v_status text;
  v_deleted_at timestamptz;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'DRAFT'
     AND NEW.status = 'PENDING_VERIFICATION'
     AND NEW.source_scheduled_session_id IS NOT NULL THEN
    v_session_id := NEW.source_scheduled_session_id;

    SELECT s.status, s.deleted_at
    INTO v_status, v_deleted_at
    FROM public.scheduled_sessions s
    WHERE s.id = v_session_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot submit: linked schedule session no longer exists.';
    END IF;

    IF v_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot submit: linked schedule session was removed.';
    END IF;

    IF v_status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Cannot submit: linked schedule session is cancelled.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_claim_submit_linked_session ON public.session_claims;
CREATE TRIGGER trg_enforce_claim_submit_linked_session
  BEFORE UPDATE ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_claim_submit_linked_session();
