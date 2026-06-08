-- ============================================================
-- 008_permissions_resource.sql
-- Seeds default permission rows for the "permissions" resource
-- so admins can control who sees the Permissions page.
--
-- Default: owner gets read access; everyone else gets none.
-- Admin always bypasses (handled in the app, not the DB).
-- ============================================================

do $$
declare
  v_owner          uuid;
  v_area_manager   uuid;
  v_branch_manager uuid;
  v_member         uuid;
begin
  select id into v_owner          from public.roles where name = 'owner';
  select id into v_area_manager   from public.roles where name = 'area_manager';
  select id into v_branch_manager from public.roles where name = 'branch_manager';
  select id into v_member         from public.roles where name = 'member';

  insert into public.permissions
    (role_id, resource, can_create, can_read, can_update, can_delete)
  values
    (v_owner,          'permissions', false, true,  false, false),
    (v_area_manager,   'permissions', false, false, false, false),
    (v_branch_manager, 'permissions', false, false, false, false),
    (v_member,         'permissions', false, false, false, false)
  on conflict (role_id, resource) do nothing;
end;
$$;
