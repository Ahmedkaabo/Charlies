-- ============================================================
-- 019_payroll_permissions.sql
-- Seeds read/write payroll permissions for manager roles.
-- Staff (bar) get no payroll access.
-- ============================================================

INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
SELECT r.id, 'payroll', true, true, true, false
FROM   public.roles r
WHERE  r.name IN ('owner', 'area_manager', 'branch_manager')
ON CONFLICT (role_id, resource) DO NOTHING;
