-- ============================================================
-- 015_bar_service_roles.sql
-- 1. Rename "member" role → "bar"  (level 4, all existing
--    branch_members records keep their role_id intact)
-- 2. Add "service" role at level 5
-- 3. Seed "service" permissions (same defaults as bar/old-member)
-- 4. Rename "staff" + "users" permission resource → "members"
--    so the unified Members module uses a single resource key
-- ============================================================

-- ── 1. Rename member → bar ────────────────────────────────────

update public.roles set name = 'bar' where name = 'member';

-- ── 2. Add service role ───────────────────────────────────────

insert into public.roles (name, level)
values ('service', 5)
on conflict (name) do nothing;

-- ── 3. Seed permissions for service (copy bar's defaults) ─────

do $$
declare
  v_owner          uuid;
  v_area_manager   uuid;
  v_branch_manager uuid;
  v_service        uuid;
begin
  select id into v_owner          from public.roles where name = 'owner';
  select id into v_area_manager   from public.roles where name = 'area_manager';
  select id into v_branch_manager from public.roles where name = 'branch_manager';
  select id into v_service        from public.roles where name = 'service';

  -- "members" resource: insert for all roles
  -- (consolidates old "staff" + "users" into one resource key)
  insert into public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
  values
    (v_owner,          'members', true,  true,  true,  true),
    (v_area_manager,   'members', true,  true,  true,  true),
    (v_branch_manager, 'members', true,  true,  false, false),
    (v_service,        'members', false, true,  false, false)
  on conflict (role_id, resource) do nothing;

  -- "bar" role for members resource (bar used to be "member")
  insert into public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
  select id, 'members', false, true, false, false
  from   public.roles where name = 'bar'
  on conflict (role_id, resource) do nothing;

  -- seed service for all other existing resources
  -- (same defaults as bar: read-only on most things)
  insert into public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
  values
    (v_service, 'branches',    false, true,  false, false),
    (v_service, 'attendance',  true,  true,  false, false),
    (v_service, 'expenses',    false, true,  false, false),
    (v_service, 'settings',    false, false, false, false),
    (v_service, 'permissions', false, false, false, false),
    (v_service, 'users',       false, false, false, false)
  on conflict (role_id, resource) do nothing;
end;
$$;

-- ── 4. Migrate "staff" and "users" resource rows → "members" ──
-- Any role that already had "staff" permissions keeps them under
-- the new "members" key (UPDATE rather than INSERT to avoid dup).

update public.permissions
set    resource = 'members'
where  resource = 'staff'
  and  not exists (
    select 1 from public.permissions p2
    where  p2.role_id  = permissions.role_id
      and  p2.resource = 'members'
  );

-- Drop now-redundant "users" rows (merged into "members")
delete from public.permissions where resource = 'users';
