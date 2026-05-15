-- Lecturer verification queue: dispute insert, tutor notifications on review actions.

-- ---------------------------------------------------------------------------
-- disputes: lecturers may open disputes on their module claims
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "disputes_lecturer_insert" ON public.disputes;
CREATE POLICY "disputes_lecturer_insert" ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    raised_by_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  );

-- ---------------------------------------------------------------------------
-- Notify tutor when lecturer changes claim status (verify / reject / dispute)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_tutor_on_claim_status_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module_code character varying(50);
  v_notification_type public.notification_type;
  v_subject text;
  v_body text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN (
    'VERIFIED'::public.claim_status,
    'APPROVED'::public.claim_status,
    'REJECTED'::public.claim_status,
    'DISPUTED'::public.claim_status
  ) THEN
    RETURN NEW;
  END IF;

  SELECT m.code INTO v_module_code
  FROM public.modules m
  WHERE m.id = NEW.module_id;

  v_notification_type := CASE NEW.status
    WHEN 'VERIFIED' THEN 'CLAIM_VERIFIED'::public.notification_type
    WHEN 'APPROVED' THEN 'CLAIM_APPROVED'::public.notification_type
    WHEN 'REJECTED' THEN 'CLAIM_REJECTED'::public.notification_type
    WHEN 'DISPUTED' THEN 'CLAIM_DISPUTED'::public.notification_type
    ELSE 'SYSTEM'::public.notification_type
  END;

  v_subject := CASE NEW.status
    WHEN 'VERIFIED' THEN 'Claim verified'
    WHEN 'APPROVED' THEN 'Claim approved'
    WHEN 'REJECTED' THEN 'Claim rejected'
    WHEN 'DISPUTED' THEN 'Claim disputed'
    ELSE 'Claim updated'
  END;

  v_body := format(
    'Your session claim for %s on %s was updated to %s.',
    COALESCE(v_module_code, 'module'),
    to_char(NEW.session_date, 'YYYY-MM-DD'),
    NEW.status::text
  );

  INSERT INTO public.notifications (
    recipient_id,
    claim_id,
    channel,
    type,
    subject,
    body
  )
  VALUES (
    NEW.tutor_id,
    NEW.id,
    'IN_APP'::public.notification_channel,
    v_notification_type,
    v_subject,
    v_body
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tutor_claim_status_review ON public.session_claims;
CREATE TRIGGER trg_notify_tutor_claim_status_review
  AFTER UPDATE ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tutor_on_claim_status_review();

-- ---------------------------------------------------------------------------
-- Notify tutor when lecturer requests clarification (no status change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_tutor_on_clarification_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor_id uuid;
  v_module_code character varying(50);
BEGIN
  IF NEW.action_type <> 'CLARIFICATION_REQUESTED' THEN
    RETURN NEW;
  END IF;

  SELECT sc.tutor_id, m.code
  INTO v_tutor_id, v_module_code
  FROM public.session_claims sc
  INNER JOIN public.modules m ON m.id = sc.module_id
  WHERE sc.id = NEW.claim_id;

  IF v_tutor_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    claim_id,
    channel,
    type,
    subject,
    body
  )
  VALUES (
    v_tutor_id,
    NEW.claim_id,
    'IN_APP'::public.notification_channel,
    'SYSTEM'::public.notification_type,
    'Clarification requested',
    format(
      'Your lecturer requested clarification on the %s claim.%s',
      COALESCE(v_module_code, 'session'),
      CASE
        WHEN NEW.comment IS NOT NULL AND length(trim(NEW.comment)) > 0
        THEN ' Note: ' || NEW.comment
        ELSE ''
      END
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tutor_clarification ON public.verification_actions;
CREATE TRIGGER trg_notify_tutor_clarification
  AFTER INSERT ON public.verification_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tutor_on_clarification_request();
