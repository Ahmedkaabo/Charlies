-- ============================================================
-- 036_payroll_adjustments_delete.sql
-- Allow admins and branch managers to delete payroll adjustments.
-- ============================================================

CREATE POLICY "payroll_adjustments_delete"
  ON public.payroll_adjustments FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR public.user_branch_role_level(branch_id) <= 3
  );
