-- ============================================================
-- 043_finance_visa.sql
-- Add is_visa flag to finance_records (credit-only field).
-- ============================================================

ALTER TABLE public.finance_records
  ADD COLUMN IF NOT EXISTS is_visa boolean NOT NULL DEFAULT false;
