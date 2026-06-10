-- ============================================================
-- 093_permissions_write_for_managers.sql
--
-- The permissions_write policy (migration 087) only allows
-- is_admin(). A Branch Owner or other manager who has
-- can_update("permissions") in their role cannot save changes
-- in the Permissions page — the DB returns 403.
--
-- Fixes:
--   1. Add get_my_role_level() SECURITY DEFINER helper so
--      the policy can compare the caller's level to the role
--      being edited without a self-referential RLS chain.
--   2. Update permissions_write to allow users who have
--      has_permission('permissions','update|create|delete')
--      to write permissions, but ONLY for roles whose level
--      is strictly higher (less privileged) than their own.
--      This prevents privilege escalation: a Branch Owner
--      (level 1) cannot touch Admin (level 0) or their own
--      role's permissions.
-- ============================================================


-- ── Helper: caller's most-privileged role level ───────────────
-- Returns the lowest level number the caller holds across staff
-- and owners assignments. Returns 0 for org admins so they can
-- always write. Returns 99 if the caller has no active role.

CREATE OR REPLACE FUNCTION public.get_my_role_level()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    LEAST(
      (SELECT MIN(r.level)
       FROM   public.staff s
       JOIN   public.roles r ON r.id = s.role_id
       WHERE  s.profile_id = auth.uid() AND s.is_active = true),
      (SELECT MIN(r.level)
       FROM   public.owners o
       JOIN   public.roles  r ON r.id = o.role_id
       WHERE  o.profile_id = auth.uid() AND o.is_active = true)
    ),
    99
  );
$$;


-- ── Update permissions_write ───────────────────────────────────

DROP POLICY IF EXISTS "permissions_write" ON public.permissions;

CREATE POLICY "permissions_write"
  ON public.permissions FOR ALL TO authenticated
  USING (
    -- Org admins can always read/update/delete any permission row.
    public.is_admin()
    OR (
      -- Non-admin managers can modify permissions for roles that are
      -- STRICTLY less privileged (higher level number) than their own.
      -- This prevents self-escalation: they cannot touch their own role
      -- or any role at a higher privilege tier.
      public.has_permission('permissions', 'update')
      AND (
        SELECT r.level FROM public.roles r WHERE r.id = role_id
      ) > public.get_my_role_level()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      (public.has_permission('permissions', 'create') OR public.has_permission('permissions', 'update'))
      AND (
        SELECT r.level FROM public.roles r WHERE r.id = role_id
      ) > public.get_my_role_level()
    )
  );


-- ── Reload PostgREST schema cache ─────────────────────────────
NOTIFY pgrst, 'reload schema';
