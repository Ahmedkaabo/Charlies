-- ============================================================
-- 040_sales_update_policy.sql
-- Records are now locked on creation. Drop the status != 'locked'
-- guard from the UPDATE policy so edits by permitted users work.
-- App-layer permission checks (isDayEditable / canEdit) gate the UI.
-- ============================================================

DROP POLICY IF EXISTS "sales_records_member_update" ON public.sales_records;

CREATE POLICY "sales_records_member_update"
  ON public.sales_records FOR UPDATE
  TO authenticated
  USING     (public.user_branch_role_level(branch_id) IS NOT NULL)
  WITH CHECK (public.user_branch_role_level(branch_id) IS NOT NULL);
