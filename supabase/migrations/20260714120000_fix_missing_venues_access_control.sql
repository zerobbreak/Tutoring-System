-- Repair migration for databases that missed the venue access-control schema.

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
