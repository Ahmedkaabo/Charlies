-- ============================================================
-- 014_users_resource.sql
-- Seed default permission rows for the "users" resource.
-- Owner gets read access (can view the Users page).
-- All other roles get no access by default — admin configures.
-- Admin always bypasses (handled in the app).
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
    (v_owner,          'users', false, true,  false, false),
    (v_area_manager,   'users', false, false, false, false),
    (v_branch_manager, 'users', false, false, false, false),
    (v_member,         'users', false, false, false, false)
  on conflict (role_id, resource) do nothing;
end;
$$;
