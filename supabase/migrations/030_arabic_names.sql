-- ============================================================
-- 030_arabic_names.sql
-- Adds optional Arabic name field to profiles and branches.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name_ar text;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS name_ar text;
