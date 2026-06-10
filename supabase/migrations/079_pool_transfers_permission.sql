-- Seed pool_transfers permissions from treasury permissions.
-- Roles that can manage treasury transfers get the same access for pool transfers
-- by default; admins can adjust from the Permissions page.
INSERT INTO permissions (role_id, resource, can_create, can_read, can_update, can_delete)
SELECT role_id, 'pool_transfers', can_create, can_read, can_update, can_delete
FROM   permissions
WHERE  resource = 'treasury'
ON CONFLICT (role_id, resource) DO NOTHING;
