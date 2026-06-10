-- 102_expense_categories_is_cogs.sql
--
-- Adds is_cogs boolean flag to expense_categories so each category
-- can be marked as a Cost of Goods Sold item for reporting purposes.
-- ============================================================

alter table public.expense_categories
  add column if not exists is_cogs boolean not null default false;
