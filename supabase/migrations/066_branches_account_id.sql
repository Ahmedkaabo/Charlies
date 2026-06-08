-- ============================================================
-- 066_branches_account_id.sql
-- Add account_id to branches so each branch is scoped to an
-- organisation, enabling invite-user onboarding to list only
-- the branches that belong to the invited organisation.
-- ============================================================

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);

-- Backfill: derive account from the branch owner's profile
UPDATE public.branches b
   SET account_id = p.account_id
  FROM public.profiles p
 WHERE p.id            = b.owner_id
   AND p.account_id   IS NOT NULL
   AND b.account_id   IS NULL;

-- ── RLS: replace the old member-only policy ───────────────────
-- Invite users have account_id set but no branch membership yet;
-- they need to see the org's branches during onboarding.

DROP POLICY IF EXISTS "members can read their branches"       ON public.branches;
DROP POLICY IF EXISTS "account members can read branches"     ON public.branches;

CREATE POLICY "account members can read branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (
    -- Is a member of this branch (staff / owners table)
    public.user_branch_role_level(id) IS NOT NULL
    -- Owns the branch
    OR owner_id = auth.uid()
    -- Same organisation — allows invite users to see all org branches
    OR (
      account_id IS NOT NULL
      AND account_id = (
        SELECT account_id FROM public.profiles WHERE id = auth.uid()
      )
    )
    -- System / org admin
    OR public.is_admin()
  );

-- Branch creation: the INSERT policy stays open (owner must = caller)
-- Update policy to also allow admins or same-account owners
DROP POLICY IF EXISTS "admins can update branches" ON public.branches;
CREATE POLICY "admins can update branches"
  ON public.branches FOR UPDATE
  TO authenticated
  USING     (public.is_admin() OR owner_id = auth.uid())
  WITH CHECK(public.is_admin() OR owner_id = auth.uid());
