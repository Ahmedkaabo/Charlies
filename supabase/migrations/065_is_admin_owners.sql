-- ============================================================
-- 065_is_admin_owners.sql
-- Extend is_admin() to also return true for users who have an
-- active record in the owners table.
--
-- Previously it only checked profiles.is_admin / system_role.
-- Users added via the Owners module have system_role='branch_owner'
-- and is_admin=false, so every table whose RLS calls is_admin()
-- for INSERT/UPDATE/DELETE returned 403 for them.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin OR system_role = 'owner'
       FROM public.profiles
      WHERE id = auth.uid()),
    false
  )
  OR EXISTS (
    SELECT 1
      FROM public.owners
     WHERE profile_id = auth.uid()
       AND is_active  = true
  )
$$;
