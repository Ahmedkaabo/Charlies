-- ============================================================
-- 055_payout_settings.sql
-- Stores the most recently used deduction config per branch.
-- Updated on every payout run save (create or update).
-- Used to pre-fill the wizard via "Use last settings".
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payout_settings (
  branch_id            uuid          PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  rent_type            text          NOT NULL DEFAULT 'fixed' CHECK (rent_type IN ('fixed','percentage')),
  rent_value           numeric(12,4) NOT NULL DEFAULT 0,
  company_share_type   text          NOT NULL DEFAULT 'fixed' CHECK (company_share_type IN ('fixed','percentage')),
  company_share_value  numeric(12,4) NOT NULL DEFAULT 0,
  mgmt_fee_type        text          NOT NULL DEFAULT 'fixed' CHECK (mgmt_fee_type IN ('fixed','percentage')),
  mgmt_fee_value       numeric(12,4) NOT NULL DEFAULT 0,
  updated_at           timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payout_settings_admin"
  ON public.payout_settings FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "payout_settings_owner_read"
  ON public.payout_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND system_role IN ('branch_owner','area_manager')
    )
  );

CREATE POLICY "payout_settings_owner_write"
  ON public.payout_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND system_role IN ('branch_owner','area_manager')
    )
  );

CREATE POLICY "payout_settings_owner_update"
  ON public.payout_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND system_role IN ('branch_owner','area_manager')
    )
  );
