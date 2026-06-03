-- Tutors discard drafts via soft-delete (deleted_at). The editable-status update policy
-- does not allow tombstone rows; add explicit soft-delete policies for claims + attendance.

-- Active-row edits only (submit, reopen, notes, etc.)
DROP POLICY IF EXISTS "session_claims_tutor_update" ON public.session_claims;
CREATE POLICY "session_claims_tutor_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND status IN (
      'DRAFT'::public.claim_status,
      'REJECTED'::public.claim_status,
      'DISPUTED'::public.claim_status
    )
    AND frozen_at IS NULL
  )
  WITH CHECK (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND frozen_at IS NULL
    AND status IN (
      'DRAFT'::public.claim_status,
      'REJECTED'::public.claim_status,
      'DISPUTED'::public.claim_status,
      'PENDING_VERIFICATION'::public.claim_status
    )
  );

-- Discard draft (set deleted_at)
DROP POLICY IF EXISTS "session_claims_tutor_soft_delete" ON public.session_claims;
CREATE POLICY "session_claims_tutor_soft_delete" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND status = 'DRAFT'::public.claim_status
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND status = 'DRAFT'::public.claim_status
  );

-- Attendance rows tied to a draft claim (before claim tombstone)
DROP POLICY IF EXISTS "session_attendance_tutor_soft_delete" ON public.session_attendance;
CREATE POLICY "session_attendance_tutor_soft_delete" ON public.session_attendance
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
        AND sc.status = 'DRAFT'::public.claim_status
    )
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
        AND sc.status = 'DRAFT'::public.claim_status
    )
  );

-- Active attendance edits (check-in) on non-deleted claims
DROP POLICY IF EXISTS "session_attendance_tutor_update" ON public.session_attendance;
CREATE POLICY "session_attendance_tutor_update" ON public.session_attendance
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );
