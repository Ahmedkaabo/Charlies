-- ============================================================
-- 023_paid_days_off.sql
-- Add paid_days_off to salary_structures.
-- paid_leave_per_month = (monthly_salary / 30) * paid_days_off
-- ============================================================

ALTER TABLE public.salary_structures
  ADD COLUMN IF NOT EXISTS paid_days_off int NOT NULL DEFAULT 0;
