-- ============================================================
-- 046_fix_owner_role.sql
-- Fix the Owner system role: rename 'owner' → 'Owner',
-- set level = 0 and is_system = true so it is hidden from
-- assignable-role dropdowns in the UI.
-- ============================================================

update public.roles
   set name      = 'Owner',
       level     = 0,
       is_system = true
 where name = 'owner';
