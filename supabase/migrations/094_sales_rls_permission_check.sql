-- Fix sales_records write policies to enforce permission checks.
-- Previously these only verified the user is staff/owner at the branch,
-- ignoring the permissions table entirely.

DROP POLICY IF EXISTS "sales_records_member_insert" ON public.sales_records;
DROP POLICY IF EXISTS "sales_records_member_update" ON public.sales_records;

-- INSERT: must have has_permission('sales','create') AND be a branch member
CREATE POLICY "sales_records_member_insert" ON public.sales_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.has_permission('sales', 'create')
      AND (
        EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.profile_id = auth.uid()
            AND s.branch_id = sales_records.branch_id
            AND s.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM public.owners o
          WHERE o.profile_id = auth.uid()
            AND o.branch_id = sales_records.branch_id
            AND o.is_active = true
        )
      )
    )
  );

-- UPDATE: must have has_permission('sales','update') AND be a branch member
CREATE POLICY "sales_records_member_update" ON public.sales_records
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.has_permission('sales', 'update')
      AND (
        EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.profile_id = auth.uid()
            AND s.branch_id = sales_records.branch_id
            AND s.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM public.owners o
          WHERE o.profile_id = auth.uid()
            AND o.branch_id = sales_records.branch_id
            AND o.is_active = true
        )
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.has_permission('sales', 'update')
      AND (
        EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.profile_id = auth.uid()
            AND s.branch_id = sales_records.branch_id
            AND s.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM public.owners o
          WHERE o.profile_id = auth.uid()
            AND o.branch_id = sales_records.branch_id
            AND o.is_active = true
        )
      )
    )
  );
