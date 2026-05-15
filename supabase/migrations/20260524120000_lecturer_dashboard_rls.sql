-- Lecturer dashboard: FK for tutor embeds, RLS for related tables, storage read,
-- lecturer notification on claim submit.

-- ---------------------------------------------------------------------------
-- session_claims.tutor_id → public.users (PostgREST embed)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.session_claims
    ADD CONSTRAINT session_claims_tutor_id_fkey
    FOREIGN KEY (tutor_id) REFERENCES public.users (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER — safe module/claim ownership checks)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_lecturer_for_module(p_module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.modules m
    WHERE m.id = p_module_id
      AND m.lecturer_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lecturer_for_claim(p_claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_claims sc
    INNER JOIN public.modules m ON m.id = sc.module_id
    WHERE sc.id = p_claim_id
      AND m.lecturer_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_lecturer_for_module(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lecturer_for_claim(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- users: lecturers may read tutors on their modules (claims or assignments)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_tutors_on_lecturer_modules" ON public.users;
CREATE POLICY "users_select_tutors_on_lecturer_modules" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'TUTOR'::public.user_role
    AND (
      EXISTS (
        SELECT 1
        FROM public.session_claims sc
        INNER JOIN public.modules m ON m.id = sc.module_id
        WHERE sc.tutor_id = users.id
          AND m.lecturer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.tutor_assignments ta
        INNER JOIN public.modules m ON m.id = ta.module_id
        WHERE ta.tutor_id = users.id
          AND m.lecturer_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- session_claims: lecturer update (verification workflow)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_claims_lecturer_update_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_update_own_modules" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (public.is_lecturer_for_module(module_id))
  WITH CHECK (public.is_lecturer_for_module(module_id));

-- ---------------------------------------------------------------------------
-- tutor_assignments: lecturers read assignments on their modules
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tutor_assignments_lecturer_select" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_lecturer_select" ON public.tutor_assignments
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_module(module_id));

-- ---------------------------------------------------------------------------
-- attendance_evidence: lecturers read evidence for their module claims
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_evidence_lecturer_select" ON public.attendance_evidence;
CREATE POLICY "attendance_evidence_lecturer_select" ON public.attendance_evidence
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_claim(claim_id));

-- ---------------------------------------------------------------------------
-- session_attendance: lecturers read attendance on their module sessions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_attendance_lecturer_select" ON public.session_attendance;
CREATE POLICY "session_attendance_lecturer_select" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_claim(session_id));

-- ---------------------------------------------------------------------------
-- verification_actions: tutors + lecturers read; lecturers insert
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "verification_actions_tutor_select" ON public.verification_actions;
CREATE POLICY "verification_actions_tutor_select" ON public.verification_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = verification_actions.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "verification_actions_lecturer_select" ON public.verification_actions;
CREATE POLICY "verification_actions_lecturer_select" ON public.verification_actions
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_claim(claim_id));

DROP POLICY IF EXISTS "verification_actions_lecturer_insert" ON public.verification_actions;
CREATE POLICY "verification_actions_lecturer_insert" ON public.verification_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  );

-- ---------------------------------------------------------------------------
-- disputes: tutors + lecturers read claims they are involved with
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "disputes_tutor_select" ON public.disputes;
CREATE POLICY "disputes_tutor_select" ON public.disputes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = disputes.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "disputes_lecturer_select" ON public.disputes;
CREATE POLICY "disputes_lecturer_select" ON public.disputes
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_claim(claim_id));

-- ---------------------------------------------------------------------------
-- audit_logs: lecturers read claim status changes on their modules
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_lecturer_select" ON public.audit_logs;
CREATE POLICY "audit_logs_lecturer_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    entity_type = 'SESSION_CLAIM'
    AND public.is_lecturer_for_claim(entity_id)
  );

-- ---------------------------------------------------------------------------
-- Storage: lecturers read register files for claims on their modules
-- Path: attendance_registers/{tutor_id}/{claim_id}/...
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_registers_select_lecturer" ON storage.objects;
CREATE POLICY "attendance_registers_select_lecturer" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance_registers'
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      INNER JOIN public.modules m ON m.id = sc.module_id
      WHERE m.lecturer_id = auth.uid()
        AND sc.tutor_id::text = (storage.foldername(name))[1]
        AND sc.id::text = (storage.foldername(name))[2]
    )
  );

-- ---------------------------------------------------------------------------
-- Notify lecturer when a tutor submits a claim for verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_lecturer_on_claim_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'PENDING_VERIFICATION'::public.claim_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (
      recipient_id,
      claim_id,
      channel,
      type,
      subject,
      body
    )
    SELECT
      m.lecturer_id,
      NEW.id,
      'IN_APP'::public.notification_channel,
      'CLAIM_SUBMITTED'::public.notification_type,
      'Claim submitted for review',
      format(
        'A tutor submitted a session claim for %s on %s.',
        m.code,
        to_char(NEW.session_date, 'YYYY-MM-DD')
      )
    FROM public.modules m
    WHERE m.id = NEW.module_id
      AND m.lecturer_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_lecturer_claim_submitted ON public.session_claims;
CREATE TRIGGER trg_notify_lecturer_claim_submitted
  AFTER UPDATE ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lecturer_on_claim_submitted();
