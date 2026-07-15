-- Venue unlock system: facial-access venues, responder flag, unlock requests, notification types.

-- ---------------------------------------------------------------------------
-- venues.access_control
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_access_control') THEN
    CREATE TYPE public.venue_access_control AS ENUM ('OPEN', 'FACIAL_RECOGNITION');
  END IF;
END $$;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS access_control public.venue_access_control NOT NULL DEFAULT 'OPEN';

COMMENT ON COLUMN public.venues.access_control IS
  'OPEN = no staff unlock needed; FACIAL_RECOGNITION = computer room requiring staff to open door.';

-- ---------------------------------------------------------------------------
-- users.can_unlock_venues
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS can_unlock_venues boolean NOT NULL DEFAULT false;

UPDATE public.users
SET can_unlock_venues = true
WHERE role = 'LECTURER'::public.user_role
  AND can_unlock_venues = false;

COMMENT ON COLUMN public.users.can_unlock_venues IS
  'When true, user may view the room-access board and claim venue unlock requests.';

-- ---------------------------------------------------------------------------
-- venue_unlock_request_status enum + venue_unlock_requests
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_unlock_request_status') THEN
    CREATE TYPE public.venue_unlock_request_status AS ENUM (
      'PENDING',
      'CLAIMED',
      'URGENT',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.venue_unlock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  scheduled_session_id uuid NOT NULL REFERENCES public.scheduled_sessions (id) ON DELETE CASCADE,
  status public.venue_unlock_request_status NOT NULL DEFAULT 'PENDING',
  claimed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  claimed_at timestamptz,
  urgent_at timestamptz,
  last_digest_at timestamptz,
  last_jit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_unlock_requests_session_unique UNIQUE (scheduled_session_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_unlock_requests_institution_id
  ON public.venue_unlock_requests (institution_id);

CREATE INDEX IF NOT EXISTS idx_venue_unlock_requests_status
  ON public.venue_unlock_requests (status)
  WHERE status IN ('PENDING', 'CLAIMED', 'URGENT');

CREATE INDEX IF NOT EXISTS idx_venue_unlock_requests_claimed_by
  ON public.venue_unlock_requests (claimed_by)
  WHERE claimed_by IS NOT NULL;

DROP TRIGGER IF EXISTS trg_venue_unlock_requests_updated_at ON public.venue_unlock_requests;
CREATE TRIGGER trg_venue_unlock_requests_updated_at
  BEFORE UPDATE ON public.venue_unlock_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- notification_type additions
-- ---------------------------------------------------------------------------
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'VENUE_UNLOCK_DAILY_DIGEST';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'VENUE_UNLOCK_JIT';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'VENUE_UNLOCK_URGENT';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'VENUE_UNLOCK_CLAIMED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'VENUE_UNLOCK_CANCELLED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'VENUE_UNLOCK_RELEASED';

-- ---------------------------------------------------------------------------
-- RLS: venue_unlock_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.venue_unlock_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_unlock_requests_select_institution" ON public.venue_unlock_requests;
CREATE POLICY "venue_unlock_requests_select_institution" ON public.venue_unlock_requests
  FOR SELECT TO authenticated
  USING (
    institution_id = public.get_auth_user_institution_id()
    AND (
      public.auth_user_has_role('ADMIN'::public.user_role)
      OR public.auth_user_has_role('SUPER_ADMIN'::public.user_role)
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.can_unlock_venues = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.scheduled_sessions ss
        JOIN public.schedule_series ser ON ser.id = ss.series_id
        WHERE ss.id = venue_unlock_requests.scheduled_session_id
          AND ser.tutor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "venue_unlock_requests_responder_update" ON public.venue_unlock_requests;
CREATE POLICY "venue_unlock_requests_responder_update" ON public.venue_unlock_requests
  FOR UPDATE TO authenticated
  USING (
    institution_id = public.get_auth_user_institution_id()
    AND (
      public.auth_user_has_role('ADMIN'::public.user_role)
      OR public.auth_user_has_role('SUPER_ADMIN'::public.user_role)
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.can_unlock_venues = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.scheduled_sessions ss
        JOIN public.schedule_series ser ON ser.id = ss.series_id
        WHERE ss.id = venue_unlock_requests.scheduled_session_id
          AND ser.tutor_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "venue_unlock_requests_service_insert" ON public.venue_unlock_requests;
CREATE POLICY "venue_unlock_requests_service_insert" ON public.venue_unlock_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- Helper: venue requires facial unlock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_requires_unlock(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.venues v
    WHERE v.id = p_venue_id
      AND v.access_control = 'FACIAL_RECOGNITION'::public.venue_access_control
      AND v.is_active = true
  );
$$;
