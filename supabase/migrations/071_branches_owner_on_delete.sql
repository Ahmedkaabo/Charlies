-- ============================================================
-- 071_branches_owner_on_delete.sql
-- Set ON DELETE SET NULL on branches.owner_id → profiles(id)
-- so deleting a profile no longer blocks on the FK constraint.
-- ============================================================

-- Drop the existing constraint (default name: branches_owner_id_fkey)
ALTER TABLE public.branches
  DROP CONSTRAINT branches_owner_id_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE public.branches
  ADD CONSTRAINT branches_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;
