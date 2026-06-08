-- ============================================================
-- 012_roles_management.sql
-- Allow admins to create, update, and delete roles.
-- Previously only a SELECT policy existed, so the roles table
-- was effectively read-only from the client side.
-- ============================================================

create policy "admins can create roles"
  on public.roles for insert
  to authenticated
  with check (public.is_admin());

create policy "admins can update roles"
  on public.roles for update
  to authenticated
  using     (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete roles"
  on public.roles for delete
  to authenticated
  using (public.is_admin());
