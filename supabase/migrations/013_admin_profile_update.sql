-- ============================================================
-- 013_admin_profile_update.sql
-- Allow admins to update any profile row.
-- Required for the Users module: toggling is_admin flag,
-- updating full_name, etc.
-- The existing policy only allows users to update their own row.
-- ============================================================

create policy "admins can update all profiles"
  on public.profiles for update
  to authenticated
  using     (public.is_admin())
  with check (public.is_admin());

-- Admins also need to be able to insert branch_members with
-- owner role (level 1) on behalf of other users.
-- The existing "owner or area_manager can add members" policy
-- requires user_branch_role_level <= 2, which may not apply
-- to an admin who isn't personally a branch member.

create policy "admins can insert any branch member"
  on public.branch_members for insert
  to authenticated
  with check (public.is_admin());

create policy "admins can update any branch member"
  on public.branch_members for update
  to authenticated
  using     (public.is_admin())
  with check (public.is_admin());
