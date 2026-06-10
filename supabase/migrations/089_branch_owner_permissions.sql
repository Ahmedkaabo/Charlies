-- ============================================================
-- 089_branch_owner_permissions.sql
--
-- The Branch Owner system role created by create_organization
-- (migration 085) has no entries in the permissions table, so
-- non-admin branch owners see zero nav items after login.
--
-- Fixes:
--   1. Seed full permissions for every existing Branch Owner
--      system role (covers roles created by migration 085 and
--      by prior create_organization calls).
--   2. Replace create_organization() to also seed permissions
--      for the Branch Owner role it creates, so future orgs
--      work out of the box.
-- ============================================================


-- ── 1. Seed permissions for existing Branch Owner roles ───────

INSERT INTO public.permissions
  (role_id, resource, can_create, can_read, can_update, can_delete)
SELECT
  r.id,
  res.resource,
  true,   -- can_create
  true,   -- can_read
  true,   -- can_update
  true    -- can_delete
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
WHERE r.name      = 'Branch Owner'
  AND r.is_system = true
ON CONFLICT (role_id, resource) DO NOTHING;


-- ── 2. Update create_organization() to seed permissions ───────

CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid  := auth.uid();
  v_account_id uuid;
  v_role_id    uuid;
  v_base_slug  text  := p_slug;
  v_final_slug text  := p_slug;
  v_counter    int   := 0;
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

  -- Seed the non-deletable Branch Owner role for this org.
  INSERT INTO public.roles (name, level, is_system, account_id)
  VALUES ('Branch Owner', 1, true, v_account_id)
  RETURNING id INTO v_role_id;

  -- Seed full permissions for the Branch Owner role so members
  -- assigned to it can see all modules from day one.
  INSERT INTO public.permissions
    (role_id, resource, can_create, can_read, can_update, can_delete)
  SELECT
    v_role_id,
    res.resource,
    true, true, true, true
  FROM (VALUES
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
  ON CONFLICT (role_id, resource) DO NOTHING;

  RETURN v_account_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_organization(text, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;
