-- Admin audit logs: query performance, MFA read for institution admins, accurate claim status actor.

CREATE INDEX IF NOT EXISTS idx_audit_logs_institution_created
  ON public.audit_logs (institution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mfa_events_occurred_at
  ON public.mfa_events (occurred_at DESC);

-- ---------------------------------------------------------------------------
-- MFA events: admins read institution users' MFA history
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "mfa_events_admin_select" ON public.mfa_events;
CREATE POLICY "mfa_events_admin_select" ON public.mfa_events
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = mfa_events.user_id
        AND u.institution_id = public.get_auth_user_institution_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Claim status audit: attribute actor to auth.uid(), institution from module
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_institution_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT m.institution_id INTO v_institution_id
    FROM public.modules m
    WHERE m.id = NEW.module_id;

    IF v_institution_id IS NOT NULL THEN
      INSERT INTO audit_logs (
        institution_id,
        actor_id,
        entity_type,
        entity_id,
        event,
        payload
      )
      VALUES (
        v_institution_id,
        auth.uid(),
        'SESSION_CLAIM',
        NEW.id,
        'STATUS_CHANGED',
        jsonb_build_object(
          'from', OLD.status,
          'to', NEW.status
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
