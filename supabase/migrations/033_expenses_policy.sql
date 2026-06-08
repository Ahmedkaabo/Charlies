-- ============================================================
-- 033_expenses_policy.sql
-- Allow admins to insert/update/delete expenses across all branches.
-- Also widens the insert policy so any branch member can add expenses
-- (previously restricted to level <= 3 / branch manager and above).
-- ============================================================

-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "branch manager and above can insert expenses" ON public.expenses;

-- Admins can do everything; branch members can insert their own rows
CREATE POLICY "expenses_insert"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.user_branch_role_level(branch_id) IS NOT NULL
      AND added_by = auth.uid()
    )
  );

-- Admins can update/delete any expense
CREATE POLICY "expenses_update"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.user_branch_role_level(branch_id) <= 3);

CREATE POLICY "expenses_delete"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.user_branch_role_level(branch_id) <= 3);

-- Admins can read all expenses (existing select policy only covers branch members)
DROP POLICY IF EXISTS "branch members can read their branch expenses" ON public.expenses;

CREATE POLICY "expenses_select"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.user_branch_role_level(branch_id) IS NOT NULL
  );
