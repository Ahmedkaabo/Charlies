-- 101_expense_categories_admin_rls.sql
--
-- Adds INSERT / UPDATE / DELETE policies on expense_categories
-- so admins (is_admin() = true, which includes owners) can manage
-- categories from the UI.
-- ============================================================

create policy "admins can insert expense categories"
  on public.expense_categories for insert
  to authenticated
  with check (public.is_admin());

create policy "admins can update expense categories"
  on public.expense_categories for update
  to authenticated
  using     (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete expense categories"
  on public.expense_categories for delete
  to authenticated
  using (public.is_admin());
