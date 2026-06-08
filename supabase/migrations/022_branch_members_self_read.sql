-- ============================================================
-- 022_branch_members_self_read.sql
-- Allow users to SELECT their own branch_members rows.
--
-- Root cause: the existing SELECT policy uses user_branch_role_level(),
-- a STABLE function that cannot see rows inserted in the same statement.
-- So an upsert+select (onboarding self-enrollment) would 403:
--   INSERT succeeds → PostgREST tries SELECT RETURNING * →
--   user_branch_role_level() returns NULL for the just-inserted row →
--   policy fails → 403.
--
-- This policy bypasses that by letting users always read their own rows.
-- ============================================================

CREATE POLICY "users can read own branch memberships"
  ON public.branch_members
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());
