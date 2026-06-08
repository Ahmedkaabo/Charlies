-- ============================================================
-- 067_multitenancy.sql
-- Enforce per-account (organisation) data isolation.
--
-- Problem: branches/staff/owners RLS was either permissive
-- (USING true) or bypassed by is_admin(), letting every org
-- see every other org's data.
--
-- Fix:
--   1. Add account_id to staff and owners tables.
--   2. Backfill from each row's associated profile.
--   3. Replace all affected SELECT/ALL policies with
--      account_id-scoped versions — no more is_admin() bypass
--      on SELECT.  Write policies (INSERT/UPDATE/DELETE) remain
--      is_admin()-gated so only org admins can mutate data.
-- ============================================================

-- ── 1. staff.account_id ──────────────────────────────────────

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);

UPDATE public.staff s
   SET account_id = p.account_id
  FROM public.profiles p
 WHERE p.id          = s.profile_id
   AND p.account_id IS NOT NULL
   AND s.account_id IS NULL;

-- ── 2. owners.account_id ─────────────────────────────────────

ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);

UPDATE public.owners o
   SET account_id = p.account_id
  FROM public.profiles p
 WHERE p.id          = o.profile_id
   AND p.account_id IS NOT NULL
   AND o.account_id IS NULL;

-- ── 3. Fix branches SELECT — no is_admin() bypass ────────────
-- Replaces the policy created in migration 066.
-- Every user (including system admins) can only SELECT branches
-- that belong to their own organisation.

DROP POLICY IF EXISTS "account members can read branches" ON public.branches;
DROP POLICY IF EXISTS "members can read their branches"   ON public.branches;

CREATE POLICY "account members can read branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (
    account_id = (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ── 4. Fix staff SELECT — account-scoped ─────────────────────

DROP POLICY IF EXISTS "staff_select" ON public.staff;
DROP POLICY IF EXISTS "staff_all"    ON public.staff;

CREATE POLICY "staff_select"
  ON public.staff FOR SELECT
  TO authenticated
  USING (
    account_id = (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Writes remain admin-gated within the same account
DROP POLICY IF EXISTS "staff_write" ON public.staff;
CREATE POLICY "staff_write"
  ON public.staff FOR ALL
  TO authenticated
  USING     (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
  )
  WITH CHECK (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
  );

-- ── 5. Fix owners SELECT — account-scoped ────────────────────

DROP POLICY IF EXISTS "owners_select" ON public.owners;
DROP POLICY IF EXISTS "owners_all"    ON public.owners;

CREATE POLICY "owners_select"
  ON public.owners FOR SELECT
  TO authenticated
  USING (
    account_id = (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owners_write" ON public.owners;
CREATE POLICY "owners_write"
  ON public.owners FOR ALL
  TO authenticated
  USING     (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
  )
  WITH CHECK (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
  );
