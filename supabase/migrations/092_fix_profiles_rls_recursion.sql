-- ============================================================
-- 092_fix_profiles_rls_recursion.sql
--
-- Migration 091 created:
--   USING (account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid()))
-- on public.profiles FOR SELECT.
--
-- This is self-referential: the policy queries the same table it
-- protects → infinite recursion → 500 on EVERY profiles request.
--
-- Fix: move the inner lookup into a SECURITY DEFINER function
-- (runs as superuser, bypasses RLS) so the recursion is broken.
-- ============================================================


-- ── Helper: get the caller's account_id without RLS ──────────
CREATE OR REPLACE FUNCTION public.get_my_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.profiles WHERE id = auth.uid();
$$;


-- ── Re-create the profiles SELECT policy using the helper ─────
DROP POLICY IF EXISTS "account members can read account profiles" ON public.profiles;

CREATE POLICY "account members can read account profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    account_id = public.get_my_account_id()
  );


-- ── Reload PostgREST schema cache ─────────────────────────────
NOTIFY pgrst, 'reload schema';
