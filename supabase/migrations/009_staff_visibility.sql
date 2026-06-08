-- ============================================================
-- 009_staff_visibility.sql
-- Extend read visibility so admins see everything, and branch
-- members can see profiles of their co-members.
--
-- Problem before this migration:
--   • profiles RLS only allowed users to read their own row,
--     so profile names / system_role came back null for everyone
--     else — including managers viewing their own staff.
--   • branch_members had no admin bypass, so an admin account
--     that isn't personally a branch member saw no staff at all.
-- ============================================================

-- ── profiles: admin read-all ──────────────────────────────────

create policy "admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- ── profiles: co-member read ──────────────────────────────────
-- A user can read a profile when both they and that profile owner
-- are active members of at least one shared branch.
-- This lets branch managers see their staff's names and roles.

create policy "branch members can read co-member profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from   public.branch_members bm_self
      join   public.branch_members bm_other
               on  bm_other.branch_id  = bm_self.branch_id
      where  bm_self.profile_id  = auth.uid()
        and  bm_other.profile_id = profiles.id
        and  bm_self.is_active   = true
        and  bm_other.is_active  = true
    )
  );

-- ── branch_members: admin read-all ───────────────────────────
-- The existing policy uses user_branch_role_level(), which returns
-- null for an admin who is not personally a branch member, so they
-- would see no staff rows at all. This bypasses that for admins.

create policy "admins can read all branch members"
  on public.branch_members for select
  to authenticated
  using (public.is_admin());

-- ── salary_structures: co-member read ─────────────────────────
-- Branch managers already have a policy (level <= 3), but admins
-- also need to see salary when they query staff outside their own
-- branches. The existing "admins can read all salaries" policy in
-- 004 covers this — no change needed here.
