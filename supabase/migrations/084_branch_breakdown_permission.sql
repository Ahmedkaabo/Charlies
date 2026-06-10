-- Add branch_breakdown as a permissioned resource.
-- Seed from existing balance permissions so any role that can read
-- the balance page also gets read access to the branch breakdown table.

INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
SELECT role_id, 'branch_breakdown', false, can_read, false, false
FROM public.permissions
WHERE resource = 'balance'
ON CONFLICT (role_id, resource) DO NOTHING;
