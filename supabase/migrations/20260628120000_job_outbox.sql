-- Lightweight job outbox for async side effects (processed by session automation cron).

DO $$ BEGIN
  CREATE TYPE public.job_outbox_status AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.job_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions (id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  status public.job_outbox_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_job_outbox_pending
  ON public.job_outbox (status, created_at)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_outbox_idempotency
  ON public.job_outbox (job_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status <> 'failed';

COMMENT ON TABLE public.job_outbox IS
  'Async work queue processed by runSessionAutomationJobs (retries + dead letter).';

ALTER TABLE public.job_outbox ENABLE ROW LEVEL SECURITY;
