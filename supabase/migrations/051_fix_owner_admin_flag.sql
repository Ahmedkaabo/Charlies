-- ============================================================
-- 051_fix_owner_admin_flag.sql
-- Ensure every profile with system_role = 'owner' has
-- is_admin = true.  Harmless on re-run (idempotent).
-- ============================================================

UPDATE public.profiles
   SET is_admin = true
 WHERE system_role = 'owner'
   AND (is_admin IS DISTINCT FROM true);
