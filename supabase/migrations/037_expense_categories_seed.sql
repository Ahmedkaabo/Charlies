-- ============================================================
-- 037_expense_categories_seed.sql
-- Fixes icons on seeded categories and adds common café ones.
-- ON CONFLICT (name) DO UPDATE so existing rows are patched too.
-- ============================================================

INSERT INTO public.expense_categories (name, icon) VALUES
  ('Supplies',           'package'),
  ('Utilities',          'zap'),
  ('Employee Debt',      'banknote'),
  ('Maintenance',        'wrench'),
  ('Equipment',          'cpu'),
  ('Rent',               'building-2'),
  ('Food & Beverages',   'utensils'),
  ('Transport',          'truck'),
  ('Marketing',          'megaphone'),
  ('Cleaning',           'sparkles'),
  ('Water',              'droplets'),
  ('Gas',                'flame'),
  ('Internet',           'wifi'),
  ('Other',              'more-horizontal')
ON CONFLICT (name) DO UPDATE
  SET icon = EXCLUDED.icon;
