-- ============================================================
-- 016_branch_delete.sql
-- Allow admins to hard-delete branches.
-- The branches table has ON DELETE CASCADE on branch_members
-- and expenses, so this will cascade to those tables.
-- ============================================================

create policy "admins can delete branches"
  on public.branches for delete
  to authenticated
  using (public.is_admin());
