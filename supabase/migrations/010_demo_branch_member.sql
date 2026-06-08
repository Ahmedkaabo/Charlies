-- ============================================================
-- 010_demo_branch_member.sql
-- Force-add the demo staff account (demo@charlies.app) to the
-- "Elestad" branch with the 'member' role.
-- Safe to apply multiple times — ON CONFLICT DO NOTHING.
-- ============================================================

do $$
declare
  v_branch_id   uuid;
  v_profile_id  uuid;
  v_role_id     uuid;
begin
  select id into v_branch_id
  from   public.branches
  where  lower(name) like '%elestad%'
  limit  1;

  if v_branch_id is null then
    raise exception 'Branch matching "elestad" not found';
  end if;

  select p.id into v_profile_id
  from   public.profiles p
  join   auth.users u on u.id = p.id
  where  u.email = 'demo@charlies.app'
  limit  1;

  if v_profile_id is null then
    raise exception 'Profile for demo@charlies.app not found';
  end if;

  select id into v_role_id
  from   public.roles
  where  name = 'member'
  limit  1;

  insert into public.branch_members (branch_id, profile_id, role_id, is_active)
  values (v_branch_id, v_profile_id, v_role_id, true)
  on conflict (branch_id, profile_id)
  do update set
    is_active = true,
    role_id   = excluded.role_id;

  raise notice 'demo@charlies.app added to branch % as member', v_branch_id;
end;
$$;
