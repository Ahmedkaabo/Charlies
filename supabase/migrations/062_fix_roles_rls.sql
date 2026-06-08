-- ============================================================
-- 062_fix_roles_rls.sql
-- Re-establish the permissive SELECT policy on public.roles so
-- every authenticated user (including owners and staff who are
-- not system admins) can read the roles table.
--
-- This also covers PostgREST relational joins — when the app
-- queries staff/owners with role:roles(...), PostgREST makes an
-- internal SELECT on roles and the policy is checked there too.
-- ============================================================

-- Drop whichever version of the policy exists, then recreate it cleanly.
DROP POLICY IF EXISTS "authenticated users can read roles" ON public.roles;
DROP POLICY IF EXISTS "all authenticated can read roles"   ON public.roles;

CREATE POLICY "authenticated users can read roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);
