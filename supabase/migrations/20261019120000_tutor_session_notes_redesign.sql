-- Session notes redesign:
-- 1) Private tutor notes live in their own table, so lecturers/admins (who can
--    read every column of session_claims) never see them.
-- 2) Lecturers can mark a session's struggle notes as seen; the tutor sees that.

-- ========== tutor_private_session_notes ==========

CREATE TABLE IF NOT EXISTS public.tutor_private_session_notes (
  claim_id uuid PRIMARY KEY REFERENCES public.session_claims (id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_private_session_notes IS
  'Tutor-only notes for a session claim. Not visible to lecturers or admins.';

CREATE INDEX IF NOT EXISTS idx_tutor_private_session_notes_tutor
  ON public.tutor_private_session_notes (tutor_id);

DROP TRIGGER IF EXISTS trg_tutor_private_session_notes_updated_at
  ON public.tutor_private_session_notes;
CREATE TRIGGER trg_tutor_private_session_notes_updated_at
  BEFORE UPDATE ON public.tutor_private_session_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tutor_private_session_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tutor_private_session_notes_owner" ON public.tutor_private_session_notes;
CREATE POLICY "tutor_private_session_notes_owner" ON public.tutor_private_session_notes
  FOR ALL TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.session_claims c
      WHERE c.id = tutor_private_session_notes.claim_id
        AND c.tutor_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_private_session_notes TO authenticated;

-- ========== session_note_acknowledgements ==========

CREATE TABLE IF NOT EXISTS public.session_note_acknowledgements (
  claim_id uuid PRIMARY KEY REFERENCES public.session_claims (id) ON DELETE CASCADE,
  seen_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.session_note_acknowledgements IS
  'Module lecturer marked the tutor''s shared session notes (struggles / review) as seen.';

ALTER TABLE public.session_note_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Module lecturer: read and mark seen for their own modules.
DROP POLICY IF EXISTS "session_note_ack_lecturer_select" ON public.session_note_acknowledgements;
CREATE POLICY "session_note_ack_lecturer_select" ON public.session_note_acknowledgements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims c
      INNER JOIN public.modules m ON m.id = c.module_id
      WHERE c.id = session_note_acknowledgements.claim_id
        AND m.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_note_ack_lecturer_insert" ON public.session_note_acknowledgements;
CREATE POLICY "session_note_ack_lecturer_insert" ON public.session_note_acknowledgements
  FOR INSERT TO authenticated
  WITH CHECK (
    seen_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.session_claims c
      INNER JOIN public.modules m ON m.id = c.module_id
      WHERE c.id = session_note_acknowledgements.claim_id
        AND m.lecturer_id = auth.uid()
    )
  );

-- Tutor: read whether their own session notes were seen.
DROP POLICY IF EXISTS "session_note_ack_tutor_select" ON public.session_note_acknowledgements;
CREATE POLICY "session_note_ack_tutor_select" ON public.session_note_acknowledgements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims c
      WHERE c.id = session_note_acknowledgements.claim_id
        AND c.tutor_id = auth.uid()
    )
  );

-- Admin: read within their institution.
DROP POLICY IF EXISTS "session_note_ack_admin_select" ON public.session_note_acknowledgements;
CREATE POLICY "session_note_ack_admin_select" ON public.session_note_acknowledgements
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

GRANT SELECT, INSERT ON public.session_note_acknowledgements TO authenticated;
