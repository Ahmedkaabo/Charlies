-- ============================================================
-- 054_payout_runs.sql
-- Manual owner payout runs with configurable per-branch
-- deductions (rent, company share, management fee).
--
-- Each run captures a snapshot of financials + deduction config
-- so the record remains accurate even if underlying data changes.
-- ============================================================

-- ── Core run record ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payout_runs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  month       integer     NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        integer     NOT NULL CHECK (year  >= 2020),
  notes       text,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_runs_month_year
  ON public.payout_runs (year, month);

-- ── Per-branch deduction config + snapshot ───────────────────

CREATE TABLE IF NOT EXISTS public.payout_run_branches (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id        uuid          NOT NULL REFERENCES public.payout_runs(id) ON DELETE CASCADE,
  branch_id            uuid          NOT NULL,
  branch_name          text          NOT NULL,
  -- rent deduction
  rent_type            text          NOT NULL DEFAULT 'fixed' CHECK (rent_type IN ('fixed','percentage')),
  rent_value           numeric(12,4) NOT NULL DEFAULT 0 CHECK (rent_value  >= 0),
  -- main company share (from net profit)
  company_share_type   text          NOT NULL DEFAULT 'fixed' CHECK (company_share_type  IN ('fixed','percentage')),
  company_share_value  numeric(12,4) NOT NULL DEFAULT 0 CHECK (company_share_value  >= 0),
  -- management fee
  mgmt_fee_type        text          NOT NULL DEFAULT 'fixed' CHECK (mgmt_fee_type  IN ('fixed','percentage')),
  mgmt_fee_value       numeric(12,4) NOT NULL DEFAULT 0 CHECK (mgmt_fee_value  >= 0),
  -- financial snapshot at time of run
  snapshot_sales       numeric(14,2) NOT NULL DEFAULT 0,
  snapshot_net_profit  numeric(14,2) NOT NULL DEFAULT 0,
  -- computed amounts (stored for history)
  rent_amount          numeric(14,2) NOT NULL DEFAULT 0,
  company_share_amount numeric(14,2) NOT NULL DEFAULT 0,
  mgmt_fee_amount      numeric(14,2) NOT NULL DEFAULT 0,
  distributable_profit numeric(14,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_payout_run_branches_run
  ON public.payout_run_branches (payout_run_id);

-- ── Computed per-owner payouts (snapshot of ownership %) ──────

CREATE TABLE IF NOT EXISTS public.payout_run_owners (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id uuid          NOT NULL REFERENCES public.payout_runs(id) ON DELETE CASCADE,
  branch_id     uuid          NOT NULL,
  branch_name   text          NOT NULL,
  profile_id    uuid          NOT NULL,
  full_name     text,
  stocks        integer       NOT NULL DEFAULT 0,
  total_stocks  integer       NOT NULL DEFAULT 0,
  percentage    numeric(8,4)  NOT NULL DEFAULT 0,
  payout_amount numeric(14,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_payout_run_owners_run
  ON public.payout_run_owners (payout_run_id);

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE public.payout_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_run_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_run_owners   ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "payout_runs_admin"
  ON public.payout_runs FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "payout_run_branches_admin"
  ON public.payout_run_branches FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "payout_run_owners_admin"
  ON public.payout_run_owners FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- Branch owners / area managers: read access
CREATE POLICY "payout_runs_owner_read"
  ON public.payout_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND system_role IN ('branch_owner','area_manager')
    )
  );

CREATE POLICY "payout_run_branches_owner_read"
  ON public.payout_run_branches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND system_role IN ('branch_owner','area_manager')
    )
  );

CREATE POLICY "payout_run_owners_owner_read"
  ON public.payout_run_owners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND system_role IN ('branch_owner','area_manager')
    )
  );

-- Branch owners / area managers: write access
CREATE POLICY "payout_runs_owner_write"
  ON public.payout_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND system_role IN ('branch_owner','area_manager')
    )
  );

CREATE POLICY "payout_run_branches_owner_write"
  ON public.payout_run_branches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND system_role IN ('branch_owner','area_manager')
    )
  );

CREATE POLICY "payout_run_owners_owner_write"
  ON public.payout_run_owners FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND system_role IN ('branch_owner','area_manager')
    )
  );

-- Branch owners / area managers: delete own runs
CREATE POLICY "payout_runs_owner_delete"
  ON public.payout_runs FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND system_role IN ('branch_owner','area_manager')
    )
  );
