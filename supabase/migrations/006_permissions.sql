-- ============================================================
-- 006_permissions.sql
-- 1. Fix roles: remove old staff sub-roles, add 'member'
-- 2. Create permissions table with RLS
-- 3. Seed sensible defaults
-- ============================================================

-- ── 1. Normalize roles ────────────────────────────────────────

-- Add 'member' (replaces barista / waiter / cashier / other)
insert into public.roles (name, level)
values ('member', 4)
on conflict (name) do nothing;

-- Migrate any branch_members still referencing the old staff roles
update public.branch_members
set    role_id = (select id from public.roles where name = 'member')
where  role_id in (
  select id from public.roles
  where  name in ('barista', 'waiter', 'cashier', 'other')
);

-- Remove the now-unused staff sub-roles
delete from public.roles where name in ('barista', 'waiter', 'cashier', 'other');

-- ── 2. Permissions table ──────────────────────────────────────

create table public.permissions (
  id          uuid    primary key default gen_random_uuid(),
  role_id     uuid    not null references public.roles(id) on delete cascade,
  resource    text    not null,
  can_create  boolean not null default false,
  can_read    boolean not null default false,
  can_update  boolean not null default false,
  can_delete  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (role_id, resource)
);

create index on public.permissions (role_id);

alter table public.permissions enable row level security;

-- All authenticated users can read permissions (needed so the app can enforce them)
create policy "authenticated users can read permissions"
  on public.permissions for select
  to authenticated
  using (true);

-- Only admins can modify permissions
create policy "admins can manage permissions"
  on public.permissions for insert
  to authenticated
  with check (public.is_admin());

create policy "admins can update permissions"
  on public.permissions for update
  to authenticated
  using     (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete permissions"
  on public.permissions for delete
  to authenticated
  using (public.is_admin());

-- ── 3. Default permission matrix ─────────────────────────────
-- Admin bypasses all of this entirely — these rows cover the
-- four branch-level roles only.

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
    -- ── Owner: full access ─────────────────────────────────
    (v_owner, 'branches',   true,  true,  true,  true),
    (v_owner, 'staff',      true,  true,  true,  true),
    (v_owner, 'attendance', true,  true,  true,  true),
    (v_owner, 'expenses',   true,  true,  true,  true),
    (v_owner, 'settings',   true,  true,  true,  true),

    -- ── Area Manager ───────────────────────────────────────
    (v_area_manager, 'branches',   true,  true,  true,  false),
    (v_area_manager, 'staff',      true,  true,  true,  true),
    (v_area_manager, 'attendance', true,  true,  true,  true),
    (v_area_manager, 'expenses',   true,  true,  true,  true),
    (v_area_manager, 'settings',   false, true,  true,  false),

    -- ── Branch Manager ─────────────────────────────────────
    (v_branch_manager, 'branches',   false, true,  false, false),
    (v_branch_manager, 'staff',      true,  true,  false, false),
    (v_branch_manager, 'attendance', true,  true,  true,  true),
    (v_branch_manager, 'expenses',   true,  true,  true,  false),
    (v_branch_manager, 'settings',   false, true,  false, false),

    -- ── Member ─────────────────────────────────────────────
    (v_member, 'branches',   false, true,  false, false),
    (v_member, 'staff',      false, true,  false, false),
    (v_member, 'attendance', true,  true,  false, false),
    (v_member, 'expenses',   false, true,  false, false),
    (v_member, 'settings',   false, false, false, false)

  on conflict (role_id, resource) do nothing;
end;
$$;
