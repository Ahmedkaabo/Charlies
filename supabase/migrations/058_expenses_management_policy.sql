-- ============================================================
-- 058_expenses_management_policy.sql
-- Extends expenses RLS to allow branch_owner and area_manager
-- system roles to insert/update/delete/select expenses on any
-- branch — they are not necessarily in branch_members.
-- ============================================================

-- ── Helper: returns true for owner, branch_owner, area_manager ──

-- Re-use the inline check rather than a new function to stay
-- consistent with the rest of the codebase.

-- INSERT
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;

CREATE POLICY "expenses_insert"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      SELECT system_role IN ('branch_owner', 'area_manager')
      FROM public.profiles WHERE id = auth.uid()
    )
    OR (
      public.user_branch_role_level(branch_id) IS NOT NULL
      AND added_by = auth.uid()
    )
  );

-- UPDATE
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;

CREATE POLICY "expenses_update"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      SELECT system_role IN ('branch_owner', 'area_manager')
      FROM public.profiles WHERE id = auth.uid()
    )
    OR public.user_branch_role_level(branch_id) <= 3
  );

-- DELETE
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;

CREATE POLICY "expenses_delete"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      SELECT system_role IN ('branch_owner', 'area_manager')
      FROM public.profiles WHERE id = auth.uid()
    )
    OR public.user_branch_role_level(branch_id) <= 3
  );

-- SELECT (ensure management can read all)
DROP POLICY IF EXISTS "expenses_select" ON public.expenses;

CREATE POLICY "expenses_select"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      SELECT system_role IN ('branch_owner', 'area_manager')
      FROM public.profiles WHERE id = auth.uid()
    )
    OR public.user_branch_role_level(branch_id) IS NOT NULL
  );
