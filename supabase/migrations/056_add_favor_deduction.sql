-- ============================================================
-- 056_add_favor_deduction.sql
-- Adds a "Favor" deduction (% or fixed of total sales) to
-- payout_run_branches and payout_settings.
-- Existing rows default to 0 — distributable_profit unchanged.
-- ============================================================

ALTER TABLE public.payout_run_branches
  ADD COLUMN IF NOT EXISTS favor_type   text          NOT NULL DEFAULT 'percentage'
    CHECK (favor_type IN ('fixed','percentage')),
  ADD COLUMN IF NOT EXISTS favor_value  numeric(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS favor_amount numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.payout_settings
  ADD COLUMN IF NOT EXISTS favor_type  text          NOT NULL DEFAULT 'percentage'
    CHECK (favor_type IN ('fixed','percentage')),
  ADD COLUMN IF NOT EXISTS favor_value numeric(12,4) NOT NULL DEFAULT 0;
