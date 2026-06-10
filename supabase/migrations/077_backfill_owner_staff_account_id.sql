-- ============================================================
-- 077_backfill_owner_staff_account_id.sql
-- Backfill `account_id` on `owners` and `staff` from their branch's
-- `account_id` where missing. Adds columns if they do not exist.
-- ============================================================

BEGIN;

-- 1) Add account_id to owners and staff if missing
ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);

-- 2) Backfill account_id from branches where possible
UPDATE public.owners o
  SET account_id = b.account_id
 FROM public.branches b
 WHERE o.branch_id = b.id
   AND o.account_id IS NULL
   AND b.account_id IS NOT NULL;

UPDATE public.staff s
  SET account_id = b.account_id
 FROM public.branches b
 WHERE s.branch_id = b.id
   AND s.account_id IS NULL
   AND b.account_id IS NOT NULL;

-- 3) Optional: ensure future inserts include account_id via trigger or
-- rely on application/server-side code. We do NOT enable NOT NULL because
-- invites or legacy rows might legitimately be NULL.

COMMIT;

-- EOF
