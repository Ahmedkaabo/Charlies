-- ============================================================
-- 024_owners_module.sql
-- Owners module: Admins role, owner module, permissions
-- ============================================================

-- ── 1. Add is_system flag to roles ───────────────────────────

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- ── 2. Create protected Admins role ──────────────────────────

INSERT INTO public.roles (name, level, is_system)
VALUES ('Admins', 0, true)
ON CONFLICT (name) DO UPDATE SET level = 0, is_system = true;

-- ── 3. Migrate existing owner members → Admins ───────────────

UPDATE public.branch_members
SET role_id = (SELECT id FROM public.roles WHERE name = 'Admins')
WHERE role_id IN (SELECT id FROM public.roles WHERE name = 'owner');

-- ── 4. Remove old owner role ──────────────────────────────────

DELETE FROM public.roles WHERE name = 'owner' AND is_system = false;

-- ── 5. Prevent deleting system roles at DB level ─────────────

CREATE OR REPLACE FUNCTION public.prevent_system_role_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION 'Cannot delete system role: %', OLD.name;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_system_roles ON public.roles;
CREATE TRIGGER protect_system_roles
  BEFORE DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_system_role_deletion();

-- ── 6. Seed full permissions for Admins role ─────────────────

INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
SELECT r.id, res.resource, true, true, true, true
FROM public.roles r
CROSS JOIN (VALUES
  ('branches'::text), ('members'), ('attendance'), ('expenses'),
  ('settings'), ('permissions'), ('payroll'), ('owners')
) AS res(resource)
WHERE r.name = 'Admins'
ON CONFLICT (role_id, resource) DO UPDATE
  SET can_create = true, can_read = true, can_update = true, can_delete = true;

-- ── 7. Update profile trigger to accept system_role in metadata

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_system_role text;
BEGIN
  -- Validate and default system_role from signup metadata
  v_system_role := CASE
    WHEN new.raw_user_meta_data ->> 'system_role' IN (
      'admin', 'branch_owner', 'area_manager', 'branch_manager', 'staff'
    )
    THEN new.raw_user_meta_data ->> 'system_role'
    ELSE 'staff'
  END;

  INSERT INTO public.profiles (id, full_name, avatar_url, phone, system_role)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'phone',
    v_system_role
  )
  ON CONFLICT (id) DO UPDATE
    SET phone = EXCLUDED.phone
    WHERE EXCLUDED.phone IS NOT NULL;

  RETURN new;
END;
$$;
