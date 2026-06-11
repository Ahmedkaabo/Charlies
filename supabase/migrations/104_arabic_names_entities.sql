-- Add Arabic name support to roles, expense_categories, and suppliers

alter table public.roles
  add column if not exists name_ar text;

alter table public.expense_categories
  add column if not exists name_ar text;

alter table public.suppliers
  add column if not exists name_ar text;
