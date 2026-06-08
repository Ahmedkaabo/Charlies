-- ============================================================
-- 064_branch_owner_role.sql
-- Create the "Branch Owner" system role and seed it with full
-- permissions on all resources. Being is_system = true means:
--   • the DB-level prevent_system_role_deletion trigger blocks DELETE
--   • the PermissionsPage UI shows "System role — cannot be deleted"
-- Every owner created in the owners module is automatically mapped
-- to this role (via useCreateOwner), so their access is controlled
-- by the permissions table and never hardcoded to full-access.
-- ============================================================

INSERT INTO public.roles (name, level, is_system, role_type)
VALUES ('Branch Owner', 1, true, 'managerial')
ON CONFLICT (name) DO UPDATE
  SET is_system  = true,
      role_type  = 'managerial';

-- Seed full CRUD on every resource (admin can restrict via the Permissions page)
INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
SELECT r.id, res.resource, true, true, true, true
FROM   public.roles r
CROSS JOIN (VALUES
  ('branches'::text), ('staff'), ('checkin'), ('attendance'),
  ('expenses'), ('sales'), ('finance'), ('balance'),
  ('settings'), ('permissions'), ('payroll'), ('owners')
) AS res(resource)
WHERE  r.name = 'Branch Owner'
ON CONFLICT (role_id, resource) DO NOTHING;
