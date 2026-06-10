-- Add direction to treasury_transfers
-- 'outflow' = branch sends money to main treasury (existing behaviour)
-- 'inflow'  = main treasury sends money back to branch
ALTER TABLE treasury_transfers
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outflow'
  CHECK (direction IN ('outflow', 'inflow'));

-- Seed treasury permissions for every role that already has balance permissions.
-- This preserves existing access: whoever could manage balance transfers can now
-- manage treasury transfers.  Admins can adjust from the Permissions page.
INSERT INTO permissions (role_id, resource, can_create, can_read, can_update, can_delete)
SELECT role_id, 'treasury', can_create, can_read, can_update, can_delete
FROM   permissions
WHERE  resource = 'balance'
ON CONFLICT (role_id, resource) DO NOTHING;
