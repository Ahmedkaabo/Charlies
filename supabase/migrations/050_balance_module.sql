-- ============================================================
-- 050_balance_module.sql
-- Treasury transfers: record money moved from branch sales
-- to the main treasury. These records are independent of the
-- Sales, Expenses, and Finance modules — they do not modify
-- any existing data, only annotate transfers for tracking.
--
-- Remaining formula (computed in the app):
--   Branch Remaining = Sales Revenue - Expenses - Transferred
--   Main Treasury    = SUM(treasury_transfers.amount)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.treasury_transfers (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid          NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  amount      numeric(10,2) NOT NULL CHECK (amount > 0),
  date        date          NOT NULL DEFAULT CURRENT_DATE,
  notes       text,
  added_by    uuid          REFERENCES public.profiles(id),
  created_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treasury_transfers_branch_date
  ON public.treasury_transfers (branch_id, date);

ALTER TABLE public.treasury_transfers ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "treasury_transfers_admin_all"
  ON public.treasury_transfers FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- Branch members: read their branch's transfers
CREATE POLICY "treasury_transfers_member_select"
  ON public.treasury_transfers FOR SELECT
  TO authenticated
  USING (public.user_branch_role_level(branch_id) IS NOT NULL);

-- Branch managers (level ≤ 3): insert/update/delete
CREATE POLICY "treasury_transfers_manager_insert"
  ON public.treasury_transfers FOR INSERT
  TO authenticated
  WITH CHECK (public.user_branch_role_level(branch_id) <= 3);

CREATE POLICY "treasury_transfers_manager_update"
  ON public.treasury_transfers FOR UPDATE
  TO authenticated
  USING     (public.user_branch_role_level(branch_id) <= 3)
  WITH CHECK (public.user_branch_role_level(branch_id) <= 3);

CREATE POLICY "treasury_transfers_manager_delete"
  ON public.treasury_transfers FOR DELETE
  TO authenticated
  USING (public.user_branch_role_level(branch_id) <= 3);


-- ── Seed balance permissions ──────────────────────────────────

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

  -- Admins: full CRUD
  IF v_admins IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_admins, 'balance', true, true, true, true)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;

  -- Area managers: full CRUD
  IF v_area_manager IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_area_manager, 'balance', true, true, true, true)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;

  -- Branch managers: CRU (no delete)
  IF v_branch_manager IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_branch_manager, 'balance', true, true, true, false)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;

  -- Staff/members: read-only
  IF v_member IS NOT NULL THEN
    INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
    VALUES (v_member, 'balance', false, true, false, false)
    ON CONFLICT (role_id, resource) DO NOTHING;
  END IF;
END;
$$;
