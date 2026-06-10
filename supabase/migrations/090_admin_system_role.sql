-- ============================================================
-- 090_admin_system_role.sql
--
-- Problem: the permission system has two separate code paths —
--   is_admin=true  → bypass all permission checks (sees everything)
--   is_admin=false → look up roles/permissions in DB (currently
--                    broken for many users, so they see nothing)
--
-- This creates a binary gate: admin sees everything, everyone
-- else sees nothing. The intended design is that ALL users see
-- what their role permits, and the admin user simply has a
-- privileged non-deletable role.
--
-- Fixes:
--   1. Create "Admin" system role per account (level=0, not
--      deletable, same pattern as "Branch Owner").
--   2. Seed full CRUD permissions for all Admin roles.
--   3. Backfill: staff rows with role_id=null get assigned the
--      account's "Branch Owner" role so they have a valid role.
--   4. Update create_organization() to also create the Admin
--      role and seed its permissions at org-creation time.
-- ============================================================


-- ── 1. Create "Admin" system role per account ─────────────────

INSERT INTO public.roles (name, level, is_system, account_id)
SELECT 'Admin', 0, true, a.id
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles
  WHERE name = 'Admin'
    AND is_system = true
    AND account_id = a.id
);


-- ── 2. Seed full permissions for all Admin system roles ────────

INSERT INTO public.permissions
  (role_id, resource, can_create, can_read, can_update, can_delete)
SELECT
  r.id,
  res.resource,
  true, true, true, true
FROM public.roles r
CROSS JOIN (VALUES
  ('branches'::text),
  ('staff'),
  ('owners'),
  ('checkin'),
  ('attendance'),
  ('expenses'),
  ('sales'),
  ('finance'),
  ('balance'),
  ('branch_breakdown'),
  ('treasury'),
  ('pool_transfers'),
  ('payroll'),
  ('settings'),
  ('permissions')
) AS res(resource)
WHERE r.name      = 'Admin'
  AND r.is_system = true
ON CONFLICT (role_id, resource) DO NOTHING;


-- ── 3. Backfill staff rows with null role_id ──────────────────
-- Staff created before the roles system are missing a role_id.
-- Assign them the account's "Branch Owner" role as a safe default
-- so the permission lookup returns something useful.

UPDATE public.staff s
SET role_id = (
  SELECT r.id
  FROM   public.roles r
  WHERE  r.name       = 'Branch Owner'
    AND  r.is_system  = true
    AND  r.account_id = s.account_id
  LIMIT  1
)
WHERE s.role_id    IS NULL
  AND s.account_id IS NOT NULL;


-- ── 4. Update create_organization() ───────────────────────────
-- Now creates both "Branch Owner" and "Admin" system roles, and
-- seeds full permissions for both.

CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid  := auth.uid();
  v_account_id     uuid;
  v_branch_owner   uuid;
  v_admin_role     uuid;
  v_base_slug      text  := p_slug;
  v_final_slug     text  := p_slug;
  v_counter        int   := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'create_organization: not authenticated';
  END IF;

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

  -- Seed the non-deletable "Branch Owner" role for this org.
  INSERT INTO public.roles (name, level, is_system, account_id)
  VALUES ('Branch Owner', 1, true, v_account_id)
  RETURNING id INTO v_branch_owner;

  -- Seed the non-deletable "Admin" role for this org.
  INSERT INTO public.roles (name, level, is_system, account_id)
  VALUES ('Admin', 0, true, v_account_id)
  RETURNING id INTO v_admin_role;

  -- Seed full permissions for both system roles.
  INSERT INTO public.permissions
    (role_id, resource, can_create, can_read, can_update, can_delete)
  SELECT role_id, res.resource, true, true, true, true
  FROM (VALUES (v_branch_owner), (v_admin_role)) AS roles(role_id)
  CROSS JOIN (VALUES
    ('branches'::text), ('staff'), ('owners'), ('checkin'), ('attendance'),
    ('expenses'), ('sales'), ('finance'), ('balance'), ('branch_breakdown'),
    ('treasury'), ('pool_transfers'), ('payroll'), ('settings'), ('permissions')
  ) AS res(resource)
  ON CONFLICT (role_id, resource) DO NOTHING;

  RETURN v_account_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_organization(text, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;


-- ── 5. Reload PostgREST schema cache ─────────────────────────
NOTIFY pgrst, 'reload schema';
