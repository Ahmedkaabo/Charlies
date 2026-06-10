-- ============================================================
-- 082_fix_rls_new_staff_schema.sql
--
-- Replace every user_branch_role_level() RLS check on the four
-- balance-related tables with a direct check against the new
-- `staff` and `owners` tables (introduced in migration 059).
-- The old function queried `branch_members` which is no longer
-- populated, causing 403 errors for all non-admin users.
-- ============================================================

-- ── sales_records ────────────────────────────────────────────

DROP POLICY IF EXISTS "sales_records_member_select" ON public.sales_records;
DROP POLICY IF EXISTS "sales_records_member_insert" ON public.sales_records;
DROP POLICY IF EXISTS "sales_records_member_update" ON public.sales_records;

CREATE POLICY "sales_records_member_select" ON public.sales_records
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = sales_records.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = sales_records.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "sales_records_member_insert" ON public.sales_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = sales_records.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = sales_records.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "sales_records_member_update" ON public.sales_records
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = sales_records.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = sales_records.branch_id AND o.is_active = true
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = sales_records.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = sales_records.branch_id AND o.is_active = true
    )
  );

-- ── expenses ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "expenses_member_select"  ON public.expenses;
DROP POLICY IF EXISTS "expenses_member_insert"  ON public.expenses;
DROP POLICY IF EXISTS "expenses_manager_update" ON public.expenses;
DROP POLICY IF EXISTS "expenses_manager_delete" ON public.expenses;

-- from migration 058 — drop by the names it used
DROP POLICY IF EXISTS "expenses_admin_all"          ON public.expenses;
DROP POLICY IF EXISTS "expenses_branch_select"      ON public.expenses;
DROP POLICY IF EXISTS "expenses_branch_insert"      ON public.expenses;
DROP POLICY IF EXISTS "expenses_branch_update"      ON public.expenses;
DROP POLICY IF EXISTS "expenses_branch_delete"      ON public.expenses;

-- Re-create with a clean name set
CREATE POLICY "expenses_admin_all" ON public.expenses
  FOR ALL TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "expenses_member_select" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = expenses.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = expenses.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "expenses_member_insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = expenses.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = expenses.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "expenses_member_update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = expenses.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = expenses.branch_id AND o.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = expenses.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = expenses.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "expenses_member_delete" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = expenses.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = expenses.branch_id AND o.is_active = true
    )
  );

-- ── treasury_transfers ───────────────────────────────────────

DROP POLICY IF EXISTS "treasury_transfers_member_select"  ON public.treasury_transfers;
DROP POLICY IF EXISTS "treasury_transfers_manager_insert" ON public.treasury_transfers;
DROP POLICY IF EXISTS "treasury_transfers_manager_update" ON public.treasury_transfers;
DROP POLICY IF EXISTS "treasury_transfers_manager_delete" ON public.treasury_transfers;

CREATE POLICY "treasury_transfers_member_select" ON public.treasury_transfers
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = treasury_transfers.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = treasury_transfers.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "treasury_transfers_manager_insert" ON public.treasury_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = treasury_transfers.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = treasury_transfers.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "treasury_transfers_manager_update" ON public.treasury_transfers
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = treasury_transfers.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = treasury_transfers.branch_id AND o.is_active = true
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = treasury_transfers.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = treasury_transfers.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "treasury_transfers_manager_delete" ON public.treasury_transfers
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = treasury_transfers.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = treasury_transfers.branch_id AND o.is_active = true
    )
  );

-- ── pool_transfers ───────────────────────────────────────────

DROP POLICY IF EXISTS "pool_transfers_member_select"  ON public.pool_transfers;
DROP POLICY IF EXISTS "pool_transfers_manager_insert" ON public.pool_transfers;
DROP POLICY IF EXISTS "pool_transfers_manager_update" ON public.pool_transfers;
DROP POLICY IF EXISTS "pool_transfers_manager_delete" ON public.pool_transfers;

CREATE POLICY "pool_transfers_member_select" ON public.pool_transfers
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = pool_transfers.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = pool_transfers.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "pool_transfers_manager_insert" ON public.pool_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = pool_transfers.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = pool_transfers.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "pool_transfers_manager_update" ON public.pool_transfers
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = pool_transfers.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = pool_transfers.branch_id AND o.is_active = true
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = pool_transfers.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = pool_transfers.branch_id AND o.is_active = true
    )
  );

CREATE POLICY "pool_transfers_manager_delete" ON public.pool_transfers
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.branch_id = pool_transfers.branch_id AND s.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.branch_id = pool_transfers.branch_id AND o.is_active = true
    )
  );
