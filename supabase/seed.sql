-- ============================================================
-- seed.sql
-- Reference data: roles and expense categories.
-- Fully idempotent — safe to run multiple times.
-- ============================================================

-- ── Roles ────────────────────────────────────────────────────
-- owner → area_manager → branch_manager → member
-- Admin is a system_role on profiles, not a branch role.

insert into public.roles (name, level) values
  ('owner',          1),
  ('area_manager',   2),
  ('branch_manager', 3),
  ('member',         4)
on conflict (name) do nothing;

-- ── Expense categories ────────────────────────────────────────

insert into public.expense_categories (name, icon) values
  ('Supplies',    'package'),
  ('Utilities',   'zap'),
  ('Salary',      'wallet'),
  ('Maintenance', 'wrench'),
  ('Equipment',   'cpu'),
  ('Other',       'more-horizontal')
on conflict (name) do nothing;
