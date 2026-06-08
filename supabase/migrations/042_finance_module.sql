-- ============================================================
-- 042_finance_module.sql
-- Branch ownership (stocks) + finance adjustments (credit/debit)
-- ============================================================

-- ── Branch ownership ──────────────────────────────────────────
-- Each row represents one owner's stock allocation in a branch.
-- Percentage = owner.stocks / SUM(stocks for branch)

CREATE TABLE IF NOT EXISTS public.branch_ownership (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid        NOT NULL REFERENCES public.branches(id)  ON DELETE CASCADE,
  profile_id  uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  stocks      integer     NOT NULL DEFAULT 1 CHECK (stocks > 0),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_ownership_branch ON public.branch_ownership (branch_id);

ALTER TABLE public.branch_ownership ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "branch_ownership_admin_all"
  ON public.branch_ownership FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- Branch members: read-only
CREATE POLICY "branch_ownership_member_select"
  ON public.branch_ownership FOR SELECT
  TO authenticated
  USING (public.user_branch_role_level(branch_id) IS NOT NULL);

-- Branch managers (level ≤ 3) can manage ownership
CREATE POLICY "branch_ownership_manager_insert"
  ON public.branch_ownership FOR INSERT
  TO authenticated
  WITH CHECK (public.user_branch_role_level(branch_id) <= 3);

CREATE POLICY "branch_ownership_manager_update"
  ON public.branch_ownership FOR UPDATE
  TO authenticated
  USING     (public.user_branch_role_level(branch_id) <= 3)
  WITH CHECK (public.user_branch_role_level(branch_id) <= 3);

CREATE POLICY "branch_ownership_manager_delete"
  ON public.branch_ownership FOR DELETE
  TO authenticated
  USING (public.user_branch_role_level(branch_id) <= 3);


-- ── Finance records ───────────────────────────────────────────
-- Manual credit (money in) / debit (money out) adjustments for
-- a branch, used alongside sales revenue and expenses to compute
-- the adjusted net profit.

CREATE TABLE IF NOT EXISTS public.finance_records (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid          NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  amount      numeric(10,2) NOT NULL CHECK (amount > 0),
  type        text          NOT NULL CHECK (type IN ('credit', 'debit')),
  description text,
  date        date          NOT NULL DEFAULT CURRENT_DATE,
  added_by    uuid          REFERENCES public.profiles(id),
  created_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_records_branch_date
  ON public.finance_records (branch_id, date);

ALTER TABLE public.finance_records ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "finance_records_admin_all"
  ON public.finance_records FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- Branch members: read their branch's records
CREATE POLICY "finance_records_member_select"
  ON public.finance_records FOR SELECT
  TO authenticated
  USING (public.user_branch_role_level(branch_id) IS NOT NULL);

-- Branch managers: insert/update/delete
CREATE POLICY "finance_records_manager_insert"
  ON public.finance_records FOR INSERT
  TO authenticated
  WITH CHECK (public.user_branch_role_level(branch_id) <= 3);

CREATE POLICY "finance_records_manager_update"
  ON public.finance_records FOR UPDATE
  TO authenticated
  USING     (public.user_branch_role_level(branch_id) <= 3)
  WITH CHECK (public.user_branch_role_level(branch_id) <= 3);

CREATE POLICY "finance_records_manager_delete"
  ON public.finance_records FOR DELETE
  TO authenticated
  USING (public.user_branch_role_level(branch_id) <= 3);


-- ── Seed finance permissions ──────────────────────────────────

DO $$
DECLARE
  v_admins         uuid;
  v_area_manager   uuid;
  v_branch_manager uuid;
  v_member         uuid;
BEGIN
  SELECT id INTO v_admins         FROM public.roles WHERE name = 'Admins'         LIMIT 1;
  SELECT id INTO v_area_manager   FROM public.roles WHERE name = 'area_manager'   LIMIT 1;
  SELECT id INTO v_branch_manager FROM public.roles WHERE name = 'branch_manager' LIMIT 1;
  SELECT id INTO v_member         FROM public.roles WHERE name IN ('member','bar') ORDER BY name LIMIT 1;

  IF v_admins IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_admins, 'finance', true, true, true, true)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;

  IF v_area_manager IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_area_manager, 'finance', true, true, true, true)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;

  IF v_branch_manager IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_branch_manager, 'finance', true, true, true, false)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;

  IF v_member IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_member, 'finance', false, true, false, false)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;
END;
$$;
