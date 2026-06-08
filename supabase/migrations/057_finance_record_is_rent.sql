-- ============================================================
-- 057_finance_record_is_rent.sql
-- Adds is_rent flag to debit finance records.
-- When true, the rent has already been paid via this adjustment
-- and should be excluded from the payout wizard's Rent field.
-- ============================================================

ALTER TABLE public.finance_records
  ADD COLUMN IF NOT EXISTS is_rent boolean NOT NULL DEFAULT false;
