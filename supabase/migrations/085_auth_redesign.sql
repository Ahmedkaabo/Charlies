-- ============================================================
-- 085_auth_redesign.sql
-- Redesign signup/signin flows for clean multi-tenancy:
--
--   1. Add accounts.slug  (org identifier / invite link key)
--   2. Remove profiles.system_role  (was never used for RLS;
--      all permissions come from staff/owners → roles → permissions)
--   3. Drop branch_members  (deprecated since migration 059;
--      all code now uses staff + owners tables)
--   4. Add roles.account_id  (org-scoped role isolation)
--   5. Backfill roles, create Branch Owner system role per org
--   6. Update RLS: roles, permissions, accounts, invites
--   7. create_organization() RPC  (atomic org bootstrap called by
--      signUp flow instead of doing it piecemeal in the client)
-- ============================================================


-- ── 1. accounts.slug ─────────────────────────────────────────

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS slug text;

-- Backfill: name → slug, append code to guarantee uniqueness.
UPDATE public.accounts
SET slug = lower(
              regexp_replace(
                regexp_replace(trim(coalesce(name, 'org')), '[^a-zA-Z0-9\s-]', '', 'g'),
                '\s+', '-', 'g'
              )
           ) || '-' || code::text
WHERE slug IS NULL;

ALTER TABLE public.accounts ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_slug_idx ON public.accounts(slug);


-- ── 2. Remove profiles.system_role ───────────────────────────
-- system_role was metadata only (never enforced in RLS).
-- is_admin is the authoritative admin flag; branch roles in
-- staff/owners are the authoritative permission source.
--
-- Several payout policies (054, 055) reference system_role directly.
-- Drop them first, then recreate them using the owners table.

DROP POLICY IF EXISTS "payout_runs_owner_read"           ON public.payout_runs;
DROP POLICY IF EXISTS "payout_run_branches_owner_read"   ON public.payout_run_branches;
DROP POLICY IF EXISTS "payout_run_owners_owner_read"     ON public.payout_run_owners;
DROP POLICY IF EXISTS "payout_runs_owner_write"          ON public.payout_runs;
DROP POLICY IF EXISTS "payout_run_branches_owner_write"  ON public.payout_run_branches;
DROP POLICY IF EXISTS "payout_run_owners_owner_write"    ON public.payout_run_owners;
DROP POLICY IF EXISTS "payout_runs_owner_delete"         ON public.payout_runs;
DROP POLICY IF EXISTS "payout_settings_owner_read"       ON public.payout_settings;
DROP POLICY IF EXISTS "payout_settings_owner_write"      ON public.payout_settings;
DROP POLICY IF EXISTS "payout_settings_owner_update"     ON public.payout_settings;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS system_role;

-- Recreate payout policies using the owners table instead of system_role.
-- "Owner" = active record in public.owners (branch owner role).

CREATE POLICY "payout_runs_owner_read"
  ON public.payout_runs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.owners WHERE profile_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "payout_run_branches_owner_read"
  ON public.payout_run_branches FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.owners WHERE profile_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "payout_run_owners_owner_read"
  ON public.payout_run_owners FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.owners WHERE profile_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "payout_runs_owner_write"
  ON public.payout_runs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.owners WHERE profile_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "payout_run_branches_owner_write"
  ON public.payout_run_branches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.owners WHERE profile_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "payout_run_owners_owner_write"
  ON public.payout_run_owners FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.owners WHERE profile_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "payout_runs_owner_delete"
  ON public.payout_runs FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.owners WHERE profile_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "payout_settings_owner_read"
  ON public.payout_settings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.owners WHERE profile_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "payout_settings_owner_write"
  ON public.payout_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.owners WHERE profile_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "payout_settings_owner_update"
  ON public.payout_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.owners WHERE profile_id = auth.uid() AND is_active = true)
  );


-- ── 3. Drop deprecated branch_members table ───────────────────
-- Superseded by staff + owners since migration 059.

DROP TABLE IF EXISTS public.branch_members CASCADE;


-- ── 4. Add account_id to roles ────────────────────────────────
-- Roles are now per-org so two orgs can have roles with the
-- same name and different permission sets.

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Remove the old global unique constraint on name.
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_name_key;

-- Per-account unique role name.
CREATE UNIQUE INDEX IF NOT EXISTS roles_account_name_idx
  ON public.roles(account_id, name)
  WHERE account_id IS NOT NULL;

-- Backfill account_id from staff assignments.
UPDATE public.roles r
SET account_id = s.account_id
FROM public.staff s
WHERE s.role_id = r.id
  AND s.account_id IS NOT NULL
  AND r.account_id IS NULL;

-- Backfill from owners assignments.
UPDATE public.roles r
SET account_id = o.account_id
FROM public.owners o
WHERE o.role_id = r.id
  AND o.account_id IS NOT NULL
  AND r.account_id IS NULL;

-- Any roles still unassigned → assign to the single/first account.
UPDATE public.roles
SET account_id = (SELECT id FROM public.accounts ORDER BY created_at LIMIT 1)
WHERE account_id IS NULL;


-- ── 5. Branch Owner system role per account ───────────────────
-- Every org needs a "Branch Owner" system role that cannot be
-- deleted. The org creator is assigned this role.

INSERT INTO public.roles (name, level, is_system, account_id)
SELECT 'Branch Owner', 1, true, a.id
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r
  WHERE r.name = 'Branch Owner'
    AND r.is_system = true
    AND r.account_id = a.id
);

-- Assign Branch Owner role to owners who have no role_id yet.
UPDATE public.owners o
SET role_id = (
  SELECT r.id
  FROM   public.roles r
  JOIN   public.branches b ON b.account_id = r.account_id
  WHERE  r.name      = 'Branch Owner'
    AND  r.is_system = true
    AND  b.id        = o.branch_id
  LIMIT 1
)
WHERE o.role_id IS NULL;


-- ── 6. Update is_admin() ──────────────────────────────────────
-- is_admin column stays named as-is; the function remains the
-- RLS entry-point. Make it STABLE so it can be inlined.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;


-- ── 7. RLS: roles (account-scoped) ───────────────────────────

DROP POLICY IF EXISTS "roles_select"        ON public.roles;
DROP POLICY IF EXISTS "roles_all"           ON public.roles;
DROP POLICY IF EXISTS "roles_write"         ON public.roles;
DROP POLICY IF EXISTS "admins_manage_roles" ON public.roles;

CREATE POLICY "roles_select"
  ON public.roles FOR SELECT TO authenticated
  USING (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "roles_write"
  ON public.roles FOR ALL TO authenticated
  USING (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
    AND (is_system IS NOT TRUE)   -- system roles cannot be modified
  )
  WITH CHECK (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
    AND (is_system IS NOT TRUE)
  );


-- ── 8. RLS: permissions (scoped via role → account) ──────────

DROP POLICY IF EXISTS "authenticated users can read permissions" ON public.permissions;
DROP POLICY IF EXISTS "admins can manage permissions"           ON public.permissions;
DROP POLICY IF EXISTS "admins can update permissions"           ON public.permissions;
DROP POLICY IF EXISTS "admins can delete permissions"           ON public.permissions;

CREATE POLICY "permissions_select"
  ON public.permissions FOR SELECT TO authenticated
  USING (
    role_id IN (
      SELECT id FROM public.roles
      WHERE  account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "permissions_write"
  ON public.permissions FOR ALL TO authenticated
  USING (
    public.is_admin()
    AND role_id IN (
      SELECT id FROM public.roles
      WHERE  account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_admin()
    AND role_id IN (
      SELECT id FROM public.roles
      WHERE  account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    )
  );


-- ── 9. RLS: accounts ─────────────────────────────────────────
-- Replace owner_id-based policy with is_admin() so all org
-- admins (not just the original creator) can manage the account.

DROP POLICY IF EXISTS "owner_manage_account" ON public.accounts;
DROP POLICY IF EXISTS "admin_manage_account" ON public.accounts;

CREATE POLICY "admin_manage_account"
  ON public.accounts FOR ALL TO authenticated
  USING (
    id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
  )
  WITH CHECK (
    id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
  );

-- Members (non-admin) can still read their own account row.
DROP POLICY IF EXISTS "member_read_account" ON public.accounts;

CREATE POLICY "member_read_account"
  ON public.accounts FOR SELECT TO authenticated
  USING (
    id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
  );


-- ── 10. RLS: account_invites ──────────────────────────────────
-- Replace owner_id-based policy with is_admin().

DROP POLICY IF EXISTS "owner_manage_invites" ON public.account_invites;
DROP POLICY IF EXISTS "admin_manage_invites"  ON public.account_invites;

CREATE POLICY "admin_manage_invites"
  ON public.account_invites FOR ALL TO authenticated
  USING (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
  )
  WITH CHECK (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
  );


-- ── 11. create_organization() RPC ────────────────────────────
-- Called by RegisterPage after auth.signUp() succeeds.
-- Runs as SECURITY DEFINER so it can bypass RLS and atomically:
--   • create the accounts row
--   • mark the profile as is_admin + account_id
--   • seed the Branch Owner system role
--
-- Returns the new account id.

CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid  := auth.uid();
  v_account_id uuid;
  v_base_slug  text  := p_slug;
  v_final_slug text  := p_slug;
  v_counter    int   := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'create_organization: not authenticated';
  END IF;

  -- Block if user already has an organisation.
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND account_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'create_organization: user already belongs to an organisation';
  END IF;

  -- Insert account, retrying with -N suffix on slug collisions.
  LOOP
    BEGIN
      INSERT INTO public.accounts (name, slug, owner_id)
      VALUES (p_name, v_final_slug, v_user_id)
      RETURNING id INTO v_account_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_counter    := v_counter + 1;
      v_final_slug := v_base_slug || '-' || v_counter::text;
      IF v_counter > 99 THEN
        RAISE EXCEPTION 'create_organization: could not generate unique slug';
      END IF;
    END;
  END LOOP;

  -- Promote profile: link to account and grant org-admin flag.
  UPDATE public.profiles
  SET account_id = v_account_id,
      is_admin   = true
  WHERE id = v_user_id;

  -- Seed the non-deletable Branch Owner role for this org.
  INSERT INTO public.roles (name, level, is_system, account_id)
  VALUES ('Branch Owner', 1, true, v_account_id);

  RETURN v_account_id;
END;
$$;

-- Only authenticated users may call this.
REVOKE EXECUTE ON FUNCTION public.create_organization(text, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;


-- ── 12. Update handle_new_user trigger ───────────────────────
-- Remove system_role from the insert (column no longer exists).
-- Add phone + email so the profile is more complete on creation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, phone, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
