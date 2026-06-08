-- ============================================================
-- 052_owner_is_admin_parity.sql
--
-- Problem: is_admin() only checked the `is_admin` boolean column.
-- Any profile with system_role = 'owner' but is_admin = false
-- (e.g. from a missed migration or race condition) would silently
-- lose all database-level access.
--
-- Fix:
--  1. Redefine is_admin() to treat system_role = 'owner' as admin
--     regardless of the boolean flag — owner implies admin.
--  2. Back-fill: set is_admin = true for all existing owner profiles
--     so the boolean stays in sync (cleaner for queries/indexes).
-- ============================================================

-- ── 1. Update the helper function ────────────────────────────

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
$$;

-- ── 2. Back-fill existing owner profiles ─────────────────────

UPDATE public.profiles
   SET is_admin = true
 WHERE system_role = 'owner'
   AND (is_admin IS DISTINCT FROM true);
