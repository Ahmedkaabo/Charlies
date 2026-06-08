-- ============================================================
-- 053_branches_admin_policies.sql
--
-- Problem: the branches UPDATE policy was written before the
-- admin role was introduced.  It only allows level ≤ 2 branch
-- members to update, so a system admin (is_admin = true /
-- system_role = 'owner') who is not in branch_members cannot
-- update any branch — the USING clause returns false, the row
-- is hidden, 0 rows are affected, and the caller sees an error.
--
-- Fix: add is_admin() to the USING and WITH CHECK of the UPDATE
-- policy, and to the INSERT WITH CHECK so admins can also create
-- branches without having to set themselves as owner first.
-- ============================================================

-- ── UPDATE ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "owner or area_manager can update branches" ON public.branches;

CREATE POLICY "owner or area_manager can update branches"
  ON public.branches FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR public.user_branch_role_level(id) <= 2
  )
  WITH CHECK (
    public.is_admin()
    OR public.user_branch_role_level(id) <= 2
  );

-- ── INSERT ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated users can create a branch" ON public.branches;

CREATE POLICY "authenticated users can create a branch"
  ON public.branches FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR owner_id = auth.uid()
  );
