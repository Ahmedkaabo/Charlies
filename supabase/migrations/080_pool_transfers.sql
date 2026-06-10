-- ============================================================
-- 080_pool_transfers.sql
-- Pool transfers: record money moved between the sales pool
-- and the expenses pool within a branch.
--
-- from_pool = 'sales',    to_pool = 'expenses'  → allocate sales to cover expenses
-- from_pool = 'expenses', to_pool = 'sales'     → return unspent budget to sales
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pool_transfers (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid          NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  from_pool   text          NOT NULL CHECK (from_pool IN ('sales','expenses')),
  to_pool     text          NOT NULL CHECK (to_pool   IN ('sales','expenses')),
  amount      numeric(10,2) NOT NULL CHECK (amount > 0),
  date        date          NOT NULL DEFAULT CURRENT_DATE,
  notes       text,
  added_by    uuid          REFERENCES public.profiles(id),
  account_id  uuid          REFERENCES public.accounts(id)  ON DELETE CASCADE,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT  pool_transfers_different_pools CHECK (from_pool <> to_pool)
);

CREATE INDEX IF NOT EXISTS idx_pool_transfers_branch_date
  ON public.pool_transfers (branch_id, date);

CREATE INDEX IF NOT EXISTS idx_pool_transfers_account_date
  ON public.pool_transfers (account_id, date);

ALTER TABLE public.pool_transfers ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "pool_transfers_admin_all"
  ON public.pool_transfers FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- Branch members: read their branch's transfers
CREATE POLICY "pool_transfers_member_select"
  ON public.pool_transfers FOR SELECT
  TO authenticated
  USING (public.user_branch_role_level(branch_id) IS NOT NULL);

-- Branch managers (level ≤ 3): insert
CREATE POLICY "pool_transfers_manager_insert"
  ON public.pool_transfers FOR INSERT
  TO authenticated
  WITH CHECK (public.user_branch_role_level(branch_id) <= 3);

-- Branch managers (level ≤ 3): update
CREATE POLICY "pool_transfers_manager_update"
  ON public.pool_transfers FOR UPDATE
  TO authenticated
  USING     (public.user_branch_role_level(branch_id) <= 3)
  WITH CHECK (public.user_branch_role_level(branch_id) <= 3);

-- Branch managers (level ≤ 3): delete
CREATE POLICY "pool_transfers_manager_delete"
  ON public.pool_transfers FOR DELETE
  TO authenticated
  USING (public.user_branch_role_level(branch_id) <= 3);
