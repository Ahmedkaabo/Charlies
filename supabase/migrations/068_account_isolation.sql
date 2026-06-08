-- ============================================================
-- 068_account_isolation.sql
-- Add account_id to every major data table so every row is
-- owned by exactly one organisation.
-- All backfills derive account_id through branch_id (or
-- created_by profile for tables with no branch link).
-- ============================================================

-- ── expenses ─────────────────────────────────────────────────
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.expenses e   SET account_id = b.account_id FROM public.branches b WHERE b.id = e.branch_id  AND b.account_id IS NOT NULL AND e.account_id  IS NULL;

-- ── sales_records ─────────────────────────────────────────────
ALTER TABLE public.sales_records ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.sales_records sr SET account_id = b.account_id FROM public.branches b WHERE b.id = sr.branch_id AND b.account_id IS NOT NULL AND sr.account_id IS NULL;

-- ── finance_records ───────────────────────────────────────────
ALTER TABLE public.finance_records ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.finance_records fr SET account_id = b.account_id FROM public.branches b WHERE b.id = fr.branch_id AND b.account_id IS NOT NULL AND fr.account_id IS NULL;

-- ── treasury_transfers ────────────────────────────────────────
ALTER TABLE public.treasury_transfers ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.treasury_transfers tt SET account_id = b.account_id FROM public.branches b WHERE b.id = tt.branch_id AND b.account_id IS NOT NULL AND tt.account_id IS NULL;

-- ── attendance_logs ───────────────────────────────────────────
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.attendance_logs al SET account_id = b.account_id FROM public.branches b WHERE b.id = al.branch_id AND b.account_id IS NOT NULL AND al.account_id IS NULL;

-- ── payroll_records ───────────────────────────────────────────
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.payroll_records pr SET account_id = b.account_id FROM public.branches b WHERE b.id = pr.branch_id AND b.account_id IS NOT NULL AND pr.account_id IS NULL;

-- ── payroll_adjustments ───────────────────────────────────────
ALTER TABLE public.payroll_adjustments ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.payroll_adjustments pa SET account_id = b.account_id FROM public.branches b WHERE b.id = pa.branch_id AND b.account_id IS NOT NULL AND pa.account_id IS NULL;

-- ── salary_structures ─────────────────────────────────────────
ALTER TABLE public.salary_structures ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.salary_structures ss SET account_id = b.account_id FROM public.branches b WHERE b.id = ss.branch_id AND b.account_id IS NOT NULL AND ss.account_id IS NULL;

-- ── branch_shifts ─────────────────────────────────────────────
ALTER TABLE public.branch_shifts ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.branch_shifts bs SET account_id = b.account_id FROM public.branches b WHERE b.id = bs.branch_id AND b.account_id IS NOT NULL AND bs.account_id IS NULL;

-- ── payout_runs (uses created_by profile) ────────────────────
ALTER TABLE public.payout_runs ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.payout_runs pr SET account_id = p.account_id FROM public.profiles p WHERE p.id = pr.created_by AND p.account_id IS NOT NULL AND pr.account_id IS NULL;

-- ── payout_settings ───────────────────────────────────────────
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);
UPDATE public.payout_settings ps SET account_id = b.account_id FROM public.branches b WHERE b.id = ps.branch_id AND b.account_id IS NOT NULL AND ps.account_id IS NULL;
