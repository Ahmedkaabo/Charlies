-- ============================================================
-- 091_fix_roles_rls_and_profiles.sql
--
-- Root causes of "access denied" for all non-admin users:
--
--   1. OLD roles (area_manager, branch_manager, bar, service …)
--      have account_id = NULL. The roles_select RLS policy filters
--      by `account_id = caller's account_id`, so non-admins can't
--      see these roles — the roles JOIN in fetchBranchRoles returns
--      null and the permissions_select RLS excludes their permissions.
--      Result: canRead() = false for every resource → PermissionGuard
--      blocks every page with "access denied".
--
--   2. The "branch members can read co-member profiles" policy
--      (migration 009) was CASCADE-dropped when migration 085 ran
--      DROP TABLE branch_members CASCADE. Non-admins now can only
--      read their own profile, so all pages that display staff
--      names show blank data.
--
--   3. staff_write / owners_write only allow is_admin().
--      Non-admin managers with can_create/can_update/can_delete
--      permissions can't actually mutate staff or owner records.
--
-- Fixes:
--   A. Backfill account_id on old roles from the staff/owners that
--      use them (same logic migration 085 attempted, now that
--      staff.account_id is reliably set by migration 088).
--   B. For old system-role names that now conflict with the new
--      per-account system roles (Branch Owner, owner → Admin),
--      migrate staff/owners references to the new roles and delete
--      the orphaned old ones.
--   C. Restore account-scoped co-member profiles SELECT policy.
--   D. Add has_permission() SECURITY DEFINER helper and use it
--      in staff_write / owners_write so role permissions gate writes.
-- ============================================================


-- ── A. Backfill account_id on old roles ───────────────────────

-- Non-system roles: set account_id from the staff rows that use them.
UPDATE public.roles r
SET account_id = (
  SELECT DISTINCT s.account_id
  FROM   public.staff s
  WHERE  s.role_id     = r.id
    AND  s.account_id IS NOT NULL
  LIMIT  1
)
WHERE r.account_id IS NULL
  AND r.is_system   IS NOT TRUE;

-- System roles that still have account_id = NULL: match by name to the
-- per-account system role that already exists for the same account.
-- Any staff/owners pointing at the old global system role are migrated
-- to the per-account one, then the orphaned global role is deleted.

-- ── Migrate old "Branch Owner" references ─────────────────────
DO $$
DECLARE
  old_id   uuid;
  new_id   uuid;
  acct_id  uuid;
BEGIN
  FOR old_id IN
    SELECT id FROM public.roles
    WHERE  name       = 'Branch Owner'
      AND  is_system  = true
      AND  account_id IS NULL
  LOOP
    -- Find which account uses this old role (via staff or owners).
    SELECT account_id INTO acct_id FROM (
      SELECT account_id FROM public.staff  WHERE role_id = old_id AND account_id IS NOT NULL
      UNION ALL
      SELECT account_id FROM public.owners WHERE role_id = old_id AND account_id IS NOT NULL
    ) AS src
    LIMIT 1;

    IF acct_id IS NULL THEN CONTINUE; END IF;

    -- Find the per-account Branch Owner system role for that account.
    SELECT id INTO new_id
    FROM   public.roles
    WHERE  name       = 'Branch Owner'
      AND  is_system  = true
      AND  account_id = acct_id
    LIMIT 1;

    IF new_id IS NOT NULL THEN
      UPDATE public.staff  SET role_id = new_id WHERE role_id = old_id;
      UPDATE public.owners SET role_id = new_id WHERE role_id = old_id;
      INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
        SELECT new_id, resource, can_create, can_read, can_update, can_delete
        FROM   public.permissions WHERE role_id = old_id
      ON CONFLICT (role_id, resource) DO NOTHING;
      DELETE FROM public.permissions WHERE role_id = old_id;
      DELETE FROM public.roles       WHERE id      = old_id;
    END IF;
  END LOOP;
END $$;

-- ── Migrate old "owner" references to the "Admin" role ────────
DO $$
DECLARE
  old_id   uuid;
  new_id   uuid;
  acct_id  uuid;
BEGIN
  FOR old_id IN
    SELECT id FROM public.roles
    WHERE  name       = 'owner'
      AND  is_system  = true
      AND  account_id IS NULL
  LOOP
    SELECT account_id INTO acct_id FROM (
      SELECT account_id FROM public.staff  WHERE role_id = old_id AND account_id IS NOT NULL
      UNION ALL
      SELECT account_id FROM public.owners WHERE role_id = old_id AND account_id IS NOT NULL
    ) AS src
    LIMIT 1;

    IF acct_id IS NULL THEN CONTINUE; END IF;

    SELECT id INTO new_id
    FROM   public.roles
    WHERE  name       = 'Admin'
      AND  is_system  = true
      AND  account_id = acct_id
    LIMIT 1;

    IF new_id IS NOT NULL THEN
      UPDATE public.staff  SET role_id = new_id WHERE role_id = old_id;
      UPDATE public.owners SET role_id = new_id WHERE role_id = old_id;
      INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
        SELECT new_id, resource, can_create, can_read, can_update, can_delete
        FROM   public.permissions WHERE role_id = old_id
      ON CONFLICT (role_id, resource) DO NOTHING;
      DELETE FROM public.permissions WHERE role_id = old_id;
      DELETE FROM public.roles       WHERE id      = old_id;
    END IF;
  END LOOP;
END $$;

-- Update prevent_system_role_deletion to only protect per-account system
-- roles (account_id IS NOT NULL). Legacy global system roles (account_id
-- IS NULL) were never per-org and can safely be removed here.
CREATE OR REPLACE FUNCTION public.prevent_system_role_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system = true AND OLD.account_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete system role: %', OLD.name;
  END IF;
  RETURN OLD;
END;
$$;

-- Remove orphaned old system roles that have no staff/owner assignments
-- (the DO blocks skipped them via CONTINUE) and whose name conflicts with
-- the per-account system roles already created by migration 090.
DELETE FROM public.permissions WHERE role_id IN (
  SELECT id FROM public.roles WHERE account_id IS NULL AND is_system = true
);
DELETE FROM public.roles WHERE account_id IS NULL AND is_system = true;

-- For any non-system roles still without account_id (no staff assignments
-- found), fall back to the first account — guarding against name conflicts.
UPDATE public.roles r
SET account_id = (SELECT id FROM public.accounts ORDER BY created_at LIMIT 1)
WHERE r.account_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.roles r2
    WHERE r2.account_id = (SELECT id FROM public.accounts ORDER BY created_at LIMIT 1)
      AND r2.name       = r.name
  );


-- ── B. Restore account-scoped profiles SELECT policy ─────────
-- Migration 009 created "branch members can read co-member profiles"
-- which JOINed on branch_members (now dropped, policy cascade-deleted).
-- Replace it with a simpler account-scoped policy.

DROP POLICY IF EXISTS "branch members can read co-member profiles" ON public.profiles;
DROP POLICY IF EXISTS "account members can read account profiles"  ON public.profiles;

CREATE POLICY "account members can read account profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    account_id = (
      SELECT account_id FROM public.profiles WHERE id = auth.uid()
    )
  );


-- ── C. has_permission() SECURITY DEFINER helper ───────────────
-- Checks whether the calling user has a given CRUD action on a
-- resource, by looking at the permissions table through their
-- staff or owners role assignment.
-- SECURITY DEFINER so it can bypass RLS on permissions/staff/owners.

CREATE OR REPLACE FUNCTION public.has_permission(p_resource text, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM   public.staff s
      JOIN   public.permissions pm ON pm.role_id = s.role_id
      WHERE  s.profile_id  = auth.uid()
        AND  s.is_active   = true
        AND  pm.resource   = p_resource
        AND  CASE p_action
               WHEN 'create' THEN pm.can_create
               WHEN 'read'   THEN pm.can_read
               WHEN 'update' THEN pm.can_update
               WHEN 'delete' THEN pm.can_delete
               ELSE false
             END
    )
    OR EXISTS (
      SELECT 1
      FROM   public.owners o
      JOIN   public.permissions pm ON pm.role_id = o.role_id
      WHERE  o.profile_id  = auth.uid()
        AND  o.is_active   = true
        AND  pm.resource   = p_resource
        AND  CASE p_action
               WHEN 'create' THEN pm.can_create
               WHEN 'read'   THEN pm.can_read
               WHEN 'update' THEN pm.can_update
               WHEN 'delete' THEN pm.can_delete
               ELSE false
             END
    );
$$;


-- ── D. Update staff_write / owners_write to respect permissions ─

DROP POLICY IF EXISTS "staff_write"  ON public.staff;
DROP POLICY IF EXISTS "owners_write" ON public.owners;

CREATE POLICY "staff_write"
  ON public.staff FOR ALL TO authenticated
  USING (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.is_admin()
      OR public.has_permission('staff', 'update')
      OR public.has_permission('staff', 'delete')
    )
  )
  WITH CHECK (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.is_admin()
      OR public.has_permission('staff', 'create')
      OR public.has_permission('staff', 'update')
    )
  );

CREATE POLICY "owners_write"
  ON public.owners FOR ALL TO authenticated
  USING (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.is_admin()
      OR public.has_permission('owners', 'update')
      OR public.has_permission('owners', 'delete')
    )
  )
  WITH CHECK (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND (
      public.is_admin()
      OR public.has_permission('owners', 'create')
      OR public.has_permission('owners', 'update')
    )
  );


-- ── E. Reload PostgREST schema cache ─────────────────────────
NOTIFY pgrst, 'reload schema';
