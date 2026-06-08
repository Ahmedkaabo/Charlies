-- ============================================================
-- 070_balance_special_permissions.sql
-- Add granular permissions for the Balance module.
-- ============================================================

ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS can_move_treasury BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS can_see_treasury BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing users who could read balance can now see treasury cards
-- and users who could create transfers can now move to treasury.
UPDATE public.permissions
   SET can_see_treasury = true
 WHERE resource = 'balance' AND can_read = true;

UPDATE public.permissions
   SET can_move_treasury = true
 WHERE resource = 'balance' AND can_create = true;
