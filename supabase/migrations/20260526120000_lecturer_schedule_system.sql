-- Lecturer-owned tutorial schedules: venues, series, occurrences, change requests,
-- session_claims bridge, tutor_assignments writes, notifications.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.schedule_series_status AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TYPE public.scheduled_session_status AS ENUM (
  'SCHEDULED',
  'CANCELLED',
  'RESCHEDULED'
);

CREATE TYPE public.schedule_series_exception_action AS ENUM (
  'CANCEL',
  'OVERRIDE'
);

CREATE TYPE public.schedule_change_request_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SCHEDULE_CHANGE_REQUESTED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SCHEDULE_CHANGE_REVIEWED';

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  name character varying(255) NOT NULL,
  code character varying(50),
  capacity integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venues_institution_id ON public.venues (institution_id);

-- ---------------------------------------------------------------------------
-- schedule_series
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  title character varying(255) NOT NULL,
  session_kind text NOT NULL DEFAULT 'tutorial',
  tutor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES public.venues (id) ON DELETE SET NULL,
  venue_text character varying(255),
  timezone text NOT NULL DEFAULT 'Africa/Johannesburg',
  dtstart timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 24 * 60),
  recurrence_json jsonb NOT NULL DEFAULT '{"frequency":"weekly","byWeekday":[1],"until":null}'::jsonb,
  status public.schedule_series_status NOT NULL DEFAULT 'DRAFT',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_series_module_id ON public.schedule_series (module_id);
CREATE INDEX IF NOT EXISTS idx_schedule_series_tutor_id ON public.schedule_series (tutor_id);
CREATE INDEX IF NOT EXISTS idx_schedule_series_status ON public.schedule_series (status);

-- ---------------------------------------------------------------------------
-- scheduled_sessions (materialized occurrences)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.schedule_series (id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules (id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  venue_id uuid REFERENCES public.venues (id) ON DELETE SET NULL,
  venue_text character varying(255),
  status public.scheduled_session_status NOT NULL DEFAULT 'SCHEDULED',
  original_starts_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_sessions_ends_after_start CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_sessions_series_starts
  ON public.scheduled_sessions (series_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_module_starts
  ON public.scheduled_sessions (module_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_tutor_starts
  ON public.scheduled_sessions (tutor_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_range
  ON public.scheduled_sessions (starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- schedule_series_exceptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_series_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.schedule_series (id) ON DELETE CASCADE,
  occurrence_starts_at timestamptz NOT NULL,
  action public.schedule_series_exception_action NOT NULL,
  override_starts_at timestamptz,
  override_ends_at timestamptz,
  override_venue_id uuid REFERENCES public.venues (id) ON DELETE SET NULL,
  override_venue_text character varying(255),
  override_tutor_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, occurrence_starts_at)
);

-- ---------------------------------------------------------------------------
-- schedule_change_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_session_id uuid NOT NULL REFERENCES public.scheduled_sessions (id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  status public.schedule_change_request_status NOT NULL DEFAULT 'PENDING',
  proposed_starts_at timestamptz NOT NULL,
  proposed_ends_at timestamptz NOT NULL,
  proposed_venue_id uuid REFERENCES public.venues (id) ON DELETE SET NULL,
  proposed_venue_text character varying(255),
  reason text,
  reviewed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_change_requests_ends_after_start CHECK (proposed_ends_at > proposed_starts_at)
);

CREATE INDEX IF NOT EXISTS idx_schedule_change_requests_session
  ON public.schedule_change_requests (scheduled_session_id);

CREATE INDEX IF NOT EXISTS idx_schedule_change_requests_status
  ON public.schedule_change_requests (status)
  WHERE status = 'PENDING';

-- ---------------------------------------------------------------------------
-- session_claims bridge
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS source_scheduled_session_id uuid
    REFERENCES public.scheduled_sessions (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.session_claims.source_scheduled_session_id IS
  'When set, this claim was created from a lecturer-published scheduled_sessions row.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_claims_scheduled_session_unique
  ON public.session_claims (tutor_id, source_scheduled_session_id)
  WHERE source_scheduled_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_claims_source_scheduled_session
  ON public.session_claims (source_scheduled_session_id)
  WHERE source_scheduled_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- tutor_assignments FK
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.tutor_assignments
    ADD CONSTRAINT tutor_assignments_tutor_id_fkey
    FOREIGN KEY (tutor_id) REFERENCES public.users (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_institution_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM public.users WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_same_institution_as_auth(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.institution_id = public.user_institution_id(auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lecturer_for_series(p_series_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.schedule_series ss
    WHERE ss.id = p_series_id
      AND public.is_lecturer_for_module(ss.module_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lecturer_for_scheduled_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.scheduled_sessions s
    WHERE s.id = p_session_id
      AND public.is_lecturer_for_module(s.module_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_institution_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_same_institution_as_auth(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lecturer_for_series(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lecturer_for_scheduled_session(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_venues_updated_at ON public.venues;
CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_schedule_series_updated_at ON public.schedule_series;
CREATE TRIGGER trg_schedule_series_updated_at
  BEFORE UPDATE ON public.schedule_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_scheduled_sessions_updated_at ON public.scheduled_sessions;
CREATE TRIGGER trg_scheduled_sessions_updated_at
  BEFORE UPDATE ON public.scheduled_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_schedule_change_requests_updated_at ON public.schedule_change_requests;
CREATE TRIGGER trg_schedule_change_requests_updated_at
  BEFORE UPDATE ON public.schedule_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS: venues
-- ---------------------------------------------------------------------------
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_select_same_institution" ON public.venues;
CREATE POLICY "venues_select_same_institution" ON public.venues
  FOR SELECT TO authenticated
  USING (
    institution_id = public.user_institution_id(auth.uid())
  );

DROP POLICY IF EXISTS "venues_lecturer_manage" ON public.venues;
CREATE POLICY "venues_lecturer_manage" ON public.venues
  FOR ALL TO authenticated
  USING (
    institution_id = public.user_institution_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('LECTURER'::public.user_role, 'ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role)
    )
  )
  WITH CHECK (
    institution_id = public.user_institution_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('LECTURER'::public.user_role, 'ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role)
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: schedule_series
-- ---------------------------------------------------------------------------
ALTER TABLE public.schedule_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_series_lecturer_all" ON public.schedule_series;
CREATE POLICY "schedule_series_lecturer_all" ON public.schedule_series
  FOR ALL TO authenticated
  USING (public.is_lecturer_for_module(module_id))
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "schedule_series_tutor_select" ON public.schedule_series;
CREATE POLICY "schedule_series_tutor_select" ON public.schedule_series
  FOR SELECT TO authenticated
  USING (
    tutor_id = auth.uid()
    AND status = 'PUBLISHED'::public.schedule_series_status
  );

-- ---------------------------------------------------------------------------
-- RLS: scheduled_sessions
-- ---------------------------------------------------------------------------
ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_sessions_lecturer_all" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_lecturer_all" ON public.scheduled_sessions
  FOR ALL TO authenticated
  USING (public.is_lecturer_for_module(module_id))
  WITH CHECK (public.is_lecturer_for_module(module_id));

DROP POLICY IF EXISTS "scheduled_sessions_tutor_select" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_tutor_select" ON public.scheduled_sessions
  FOR SELECT TO authenticated
  USING (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.schedule_series ss
      WHERE ss.id = scheduled_sessions.series_id
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: schedule_series_exceptions
-- ---------------------------------------------------------------------------
ALTER TABLE public.schedule_series_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_series_exceptions_lecturer_all" ON public.schedule_series_exceptions;
CREATE POLICY "schedule_series_exceptions_lecturer_all" ON public.schedule_series_exceptions
  FOR ALL TO authenticated
  USING (public.is_lecturer_for_series(series_id))
  WITH CHECK (
    public.is_lecturer_for_series(series_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "schedule_series_exceptions_tutor_select" ON public.schedule_series_exceptions;
CREATE POLICY "schedule_series_exceptions_tutor_select" ON public.schedule_series_exceptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.schedule_series ss
      WHERE ss.id = schedule_series_exceptions.series_id
        AND ss.tutor_id = auth.uid()
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: schedule_change_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.schedule_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_change_requests_tutor_insert" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_tutor_insert" ON public.schedule_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      WHERE s.id = scheduled_session_id
        AND s.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "schedule_change_requests_tutor_select_own" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_tutor_select_own" ON public.schedule_change_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

DROP POLICY IF EXISTS "schedule_change_requests_lecturer_select" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_lecturer_select" ON public.schedule_change_requests
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_scheduled_session(scheduled_session_id));

DROP POLICY IF EXISTS "schedule_change_requests_lecturer_update" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_lecturer_update" ON public.schedule_change_requests
  FOR UPDATE TO authenticated
  USING (public.is_lecturer_for_scheduled_session(scheduled_session_id))
  WITH CHECK (public.is_lecturer_for_scheduled_session(scheduled_session_id));

-- ---------------------------------------------------------------------------
-- RLS: tutor_assignments writes (lecturer)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tutor_assignments_lecturer_insert" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_lecturer_insert" ON public.tutor_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = tutor_id AND u.role = 'TUTOR'::public.user_role
    )
  );

DROP POLICY IF EXISTS "tutor_assignments_lecturer_update" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_lecturer_update" ON public.tutor_assignments
  FOR UPDATE TO authenticated
  USING (public.is_lecturer_for_module(module_id))
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
  );

DROP POLICY IF EXISTS "tutor_assignments_lecturer_delete" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_lecturer_delete" ON public.tutor_assignments
  FOR DELETE TO authenticated
  USING (public.is_lecturer_for_module(module_id));

-- ---------------------------------------------------------------------------
-- session_claims: lecturer insert for published schedule bridge
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_claims_lecturer_insert_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_insert_own_modules" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND (
      source_scheduled_session_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.scheduled_sessions s
        WHERE s.id = source_scheduled_session_id
          AND s.module_id = session_claims.module_id
          AND s.tutor_id = session_claims.tutor_id
      )
    )
  );

DROP POLICY IF EXISTS "session_claims_tutor_insert_scheduled_session" ON public.session_claims;
CREATE POLICY "session_claims_tutor_insert_scheduled_session" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND source_scheduled_session_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      INNER JOIN public.schedule_series ss ON ss.id = s.series_id
      WHERE s.id = source_scheduled_session_id
        AND s.tutor_id = auth.uid()
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications: schedule change requested → lecturer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_lecturer_on_schedule_change_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lecturer_id uuid;
  v_module_code character varying(50);
  v_tutor_name character varying(255);
BEGIN
  SELECT m.lecturer_id, m.code INTO v_lecturer_id, v_module_code
  FROM public.scheduled_sessions s
  INNER JOIN public.modules m ON m.id = s.module_id
  WHERE s.id = NEW.scheduled_session_id;

  SELECT u.full_name INTO v_tutor_name
  FROM public.users u
  WHERE u.id = NEW.requested_by;

  IF v_lecturer_id IS NULL THEN
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
    v_lecturer_id,
    NULL,
    'IN_APP'::public.notification_channel,
    'SCHEDULE_CHANGE_REQUESTED'::public.notification_type,
    'Schedule change requested',
    format(
      '%s requested a schedule change for %s (%s).',
      COALESCE(v_tutor_name, 'A tutor'),
      COALESCE(v_module_code, 'module'),
      to_char(NEW.proposed_starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_change_request_notify ON public.schedule_change_requests;
CREATE TRIGGER trg_schedule_change_request_notify
  AFTER INSERT ON public.schedule_change_requests
  FOR EACH ROW
  WHEN (NEW.status = 'PENDING'::public.schedule_change_request_status)
  EXECUTE FUNCTION public.notify_lecturer_on_schedule_change_request();

-- ---------------------------------------------------------------------------
-- Notifications: schedule change reviewed → tutor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_tutor_on_schedule_change_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor_id uuid;
  v_module_code character varying(50);
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN (
    'APPROVED'::public.schedule_change_request_status,
    'REJECTED'::public.schedule_change_request_status
  ) THEN
    RETURN NEW;
  END IF;

  SELECT s.tutor_id, m.code INTO v_tutor_id, v_module_code
  FROM public.scheduled_sessions s
  INNER JOIN public.modules m ON m.id = s.module_id
  WHERE s.id = NEW.scheduled_session_id;

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
    NULL,
    'IN_APP'::public.notification_channel,
    'SCHEDULE_CHANGE_REVIEWED'::public.notification_type,
    CASE NEW.status
      WHEN 'APPROVED' THEN 'Schedule change approved'
      ELSE 'Schedule change rejected'
    END,
    format(
      'Your schedule change request for %s was %s.',
      COALESCE(v_module_code, 'module'),
      lower(NEW.status::text)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_change_review_notify ON public.schedule_change_requests;
CREATE TRIGGER trg_schedule_change_review_notify
  AFTER UPDATE ON public.schedule_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tutor_on_schedule_change_review();
