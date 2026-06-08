-- ============================================================
-- 026_role_type.sql
-- Add role_type to roles: 'managerial' (admin-like views)
-- or 'operational' (staff check-in views).
-- ============================================================

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS role_type text NOT NULL DEFAULT 'operational'
  CONSTRAINT roles_role_type_check CHECK (role_type IN ('managerial', 'operational'));

-- Seed sensible defaults for existing roles
UPDATE public.roles SET role_type = 'managerial'  WHERE name IN ('Admins', 'area_manager', 'branch_manager');
UPDATE public.roles SET role_type = 'operational' WHERE name IN ('bar');
