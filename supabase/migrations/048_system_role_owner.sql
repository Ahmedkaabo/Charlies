-- ============================================================
-- 048_system_role_owner.sql
-- Rename system_role value 'admin' → 'owner'.
-- 1. Drop old check constraint and add updated one.
-- 2. Update any existing 'admin' rows to 'owner'.
-- 3. Update the profile trigger allowlist.
-- 4. Re-seed the master Owner profile with correct value.
-- ============================================================

-- ── 1. Drop old constraint ────────────────────────────────────

alter table public.profiles
  drop constraint if exists profiles_system_role_check;

-- ── 2. Migrate existing 'admin' rows first ───────────────────

update public.profiles set system_role = 'owner' where system_role = 'admin';

-- ── 3. Add updated constraint ─────────────────────────────────

alter table public.profiles
  add constraint profiles_system_role_check
  check (system_role in ('owner', 'branch_owner', 'area_manager', 'branch_manager', 'staff'));

-- ── 3. Update profile trigger to accept 'owner' ───────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system_role text;
begin
  v_system_role := case
    when new.raw_user_meta_data ->> 'system_role' in (
      'owner', 'branch_owner', 'area_manager', 'branch_manager', 'staff'
    )
    then new.raw_user_meta_data ->> 'system_role'
    else 'staff'
  end;

  insert into public.profiles (id, full_name, avatar_url, phone, email, system_role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'phone',
    new.email,
    v_system_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ── 4. Fix master Owner profile ───────────────────────────────

update public.profiles
   set system_role = 'owner',
       is_admin    = true
 where email = 'owner@charlies.com';
