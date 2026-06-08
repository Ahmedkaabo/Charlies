-- ============================================================
-- 072_branches_account_on_delete.sql
-- Set ON DELETE CASCADE on branches.account_id → accounts(id)
-- so deleting an account cascades to its branches.
-- ============================================================

-- Drop the existing constraint
ALTER TABLE public.branches
  DROP CONSTRAINT branches_account_id_fkey;

-- Re-add with ON DELETE CASCADE
ALTER TABLE public.branches
  ADD CONSTRAINT branches_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id)
  ON DELETE CASCADE;
