-- Fix: properly remove trigger/function that blocked system role edits
-- (096 failed mid-execution because it used the wrong trigger name)

-- Drop with the correct trigger name this time
DROP TRIGGER IF EXISTS protect_system_roles ON public.roles;
DROP TRIGGER IF EXISTS prevent_system_role_deletion ON public.roles;
DROP FUNCTION IF EXISTS public.prevent_system_role_deletion() CASCADE;
DROP FUNCTION IF EXISTS public.protect_system_roles() CASCADE;

-- Recreate the write policy without the is_system guard
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
