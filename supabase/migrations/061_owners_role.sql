-- ============================================================
-- 061_owners_role.sql
-- Add role_id to the owners table so each owner can be assigned
-- an explicit role whose permissions are applied via the normal
-- permissions table, exactly like staff members.
-- Nullable: existing owners with no role get full access by default.
-- ============================================================

ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;
