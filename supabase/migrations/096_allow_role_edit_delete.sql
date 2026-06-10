-- Allow admins to edit and delete any role (including system roles)

-- 1. Remove the trigger that prevented system role deletion
DROP TRIGGER IF EXISTS prevent_system_role_deletion ON public.roles;
DROP TRIGGER IF EXISTS protect_system_roles ON public.roles;
DROP FUNCTION IF EXISTS public.prevent_system_role_deletion() CASCADE;

-- 2. Replace the write policy that blocked system role modifications
DROP POLICY IF EXISTS "roles_write" ON public.roles;

CREATE POLICY "roles_write"
  ON public.roles
  FOR ALL
  TO authenticated
  USING (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
  )
  WITH CHECK (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    AND public.is_admin()
  );
