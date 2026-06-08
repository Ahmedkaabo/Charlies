-- ============================================================
-- 011_role_unification.sql
-- 1. Allow all authenticated users to list branches — new users
--    need to see the full list to pick one during onboarding.
-- 2. Allow users to self-enroll in a branch as a member —
--    needed so a new user can join a branch right after signup.
--    They can only assign themselves the "member" role (level 4).
-- ============================================================

-- ── 1. Branches: readable by all authenticated users ─────────
-- The existing policy already OR-gates on member/owner checks;
-- adding this policy widens it to all authenticated sessions,
-- which is intentional for the onboarding branch-selection screen.

create policy "authenticated users can read all branches"
  on public.branches for select
  to authenticated
  using (true);

-- ── 2. branch_members: self-enroll as member only ────────────
-- A user may insert themselves into a branch IF the role they are
-- claiming is level 4 (member). Owners / managers are assigned by
-- existing users with the right branch role level.

create policy "users can self-enroll in branches as member"
  on public.branch_members for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and (
      select r.level
      from   public.roles r
      where  r.id = role_id
    ) = 4
  );
