-- Tutor read access to payroll batches for own claims + compensation rates (R225 default).

-- ---------------------------------------------------------------------------
-- Compensation rates
-- ---------------------------------------------------------------------------
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS default_tutor_hourly_rate_cents integer NOT NULL DEFAULT 22500,
  ADD COLUMN IF NOT EXISTS rate_currency char(3) NOT NULL DEFAULT 'ZAR';

COMMENT ON COLUMN public.institutions.default_tutor_hourly_rate_cents IS
  'Default tutor hourly rate in cents (22500 = R225.00/hr).';

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS tutor_hourly_rate_cents integer;

COMMENT ON COLUMN public.modules.tutor_hourly_rate_cents IS
  'Optional per-module hourly rate override in cents; NULL uses institution default.';

ALTER TABLE public.tutor_assignments
  ADD COLUMN IF NOT EXISTS hourly_rate_cents integer;

COMMENT ON COLUMN public.tutor_assignments.hourly_rate_cents IS
  'Optional per-assignment hourly rate override in cents.';

UPDATE public.institutions
SET default_tutor_hourly_rate_cents = 22500
WHERE default_tutor_hourly_rate_cents IS NULL;

CREATE TABLE IF NOT EXISTS public.claim_compensation (
  claim_id uuid PRIMARY KEY REFERENCES public.session_claims (id) ON DELETE CASCADE,
  hourly_rate_cents integer NOT NULL,
  hours numeric(5, 2) NOT NULL,
  amount_cents integer NOT NULL,
  currency char(3) NOT NULL DEFAULT 'ZAR',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  paid_reference character varying(255)
);

COMMENT ON TABLE public.claim_compensation IS
  'Immutable compensation snapshot when a claim is admin-approved.';

ALTER TABLE public.claim_compensation ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: claim_compensation
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "claim_compensation_tutor_select_own" ON public.claim_compensation;
CREATE POLICY "claim_compensation_tutor_select_own" ON public.claim_compensation
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_claims sc
      WHERE sc.id = claim_compensation.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "claim_compensation_admin_select" ON public.claim_compensation;
CREATE POLICY "claim_compensation_admin_select" ON public.claim_compensation
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1 FROM public.session_claims sc
      JOIN public.modules m ON m.id = sc.module_id
      WHERE sc.id = claim_compensation.claim_id
        AND m.institution_id = public.get_auth_user_institution_id()
    )
  );

-- Inserts via service role / admin server actions only (no client insert policy).

-- ---------------------------------------------------------------------------
-- RLS: tutor payroll export visibility
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "payroll_export_claims_tutor_select" ON public.payroll_export_claims;
CREATE POLICY "payroll_export_claims_tutor_select" ON public.payroll_export_claims
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_claims sc
      WHERE sc.id = payroll_export_claims.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "payroll_exports_tutor_select" ON public.payroll_exports;
CREATE POLICY "payroll_exports_tutor_select" ON public.payroll_exports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.payroll_export_claims pec
      JOIN public.session_claims sc ON sc.id = pec.claim_id
      WHERE pec.export_id = payroll_exports.id
        AND sc.tutor_id = auth.uid()
    )
  );
