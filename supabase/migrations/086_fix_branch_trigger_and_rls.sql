-- ============================================================
-- 086_fix_branch_trigger_and_rls.sql
--
-- Problem: migration 085 dropped branch_members CASCADE, but
-- two objects still reference the table at runtime:
--
--   1. on_branch_created trigger + handle_branch_created() —
--      fires after every INSERT on branches and tries to insert
--      into the now-dropped branch_members table. PostgreSQL
--      raises error 42P01 (undefined_table); PostgREST maps
--      that code to HTTP 404, so every branch creation fails.
--
--   2. user_branch_role_level() — SQL function that selects
--      from branch_members. Still referenced by the branches
--      UPDATE policy from migration 053. Calling it now throws
--      42P01 as well, breaking branch UPDATE and any other
--      table whose policy still uses it.
--
-- Fixes:
--   A. Drop the stale trigger + function.
--   B. Replace user_branch_role_level() to use staff/owners.
--   C. Reload PostgREST schema cache.
-- ============================================================


-- ── A. Drop stale trigger and function ───────────────────────

DROP TRIGGER  IF EXISTS on_branch_created ON public.branches;
DROP FUNCTION IF EXISTS public.handle_branch_created();


-- ── B. Replace user_branch_role_level() ──────────────────────
-- New version queries staff + owners instead of branch_members.
-- Returns the lowest role level the caller has in the given
-- branch (across staff and owner assignments), or 99 if none.

CREATE OR REPLACE FUNCTION public.user_branch_role_level(p_branch_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT MIN(r.level)
      FROM (
        SELECT role_id FROM public.staff
        WHERE  profile_id = auth.uid()
          AND  branch_id  = p_branch_id
          AND  is_active  = true
        UNION ALL
        SELECT role_id FROM public.owners
        WHERE  profile_id = auth.uid()
          AND  branch_id  = p_branch_id
          AND  is_active  = true
      ) u
      JOIN public.roles r ON r.id = u.role_id
    ),
    99
  );
$$;


-- ── C. Reload PostgREST schema cache ─────────────────────────
NOTIFY pgrst, 'reload schema';
